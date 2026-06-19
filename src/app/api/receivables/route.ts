import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { canAccessHutangPiutang } from "@/lib/entitlements";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  borrower_name: z.string().min(1).max(120),
  total_amount_minor: z.number().int().positive(),
  initial_remaining_amount_minor: z.number().int().min(0).optional(),
  due_date: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

type ReceivableRow = {
  id: string;
  user_id: string;
  name: string;
  borrower_name: string;
  total_amount_minor: string;
  currency: string;
  due_date: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  collected_amount_minor: string;
};

async function requirePremium(userId: string) {
  const result = await query<{ plan: string | null }>(
    "select plan from subscription_entitlements where user_id = $1 and status = 'active' and (current_period_end is null or current_period_end > now())",
    [userId]
  );
  const plan = (result.rows[0]?.plan ?? "free") as "free" | "premium";
  return canAccessHutangPiutang(plan);
}

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const access = await requirePremium(auth.user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: 402 });
  }

  const result = await query<ReceivableRow>(
    `select r.*, coalesce(p.collected, 0) as collected_amount_minor
     from receivables r
     left join (
       select receivable_id, sum(amount_minor) as collected
       from receivable_payments
       group by receivable_id
     ) p on p.receivable_id = r.id
     where r.user_id = $1 and r.status = 'active'
     order by r.created_at desc`,
    [auth.user.id]
  );

  const rows = result.rows.map((row) => {
    const total = Number(row.total_amount_minor);
    const collected = Number(row.collected_amount_minor);
    return {
      id: row.id,
      name: row.name,
      borrower_name: row.borrower_name,
      total_amount_minor: total,
      collected_amount_minor: collected,
      remaining_amount_minor: total - collected,
      currency: row.currency,
      due_date: row.due_date,
      notes: row.notes,
      status: row.status,
      created_at: row.created_at
    };
  });

  const summary = rows.reduce(
    (acc, row) => {
      acc.total_lent_minor += row.total_amount_minor;
      acc.total_collected_minor += row.collected_amount_minor;
      acc.total_remaining_minor += row.remaining_amount_minor;
      return acc;
    },
    { total_lent_minor: 0, total_collected_minor: 0, total_remaining_minor: 0 }
  );

  return NextResponse.json({ receivables: rows, summary });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const access = await requirePremium(auth.user.id);
  if (!access.ok) {
    return NextResponse.json({ error: access.reason }, { status: 402 });
  }

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data piutang tidak valid." }, { status: 400 });
  }
  const input = parsed.data;

  if (input.initial_remaining_amount_minor !== undefined && input.initial_remaining_amount_minor > input.total_amount_minor) {
    return NextResponse.json({ error: "Sisa awal tidak boleh lebih besar dari total piutang." }, { status: 400 });
  }

  const insertResult = await query<{ id: string }>(
    `insert into receivables (user_id, name, borrower_name, total_amount_minor, due_date, notes)
     values ($1, $2, $3, $4, $5, $6)
     returning id`,
    [
      auth.user.id,
      input.name.trim(),
      input.borrower_name.trim(),
      input.total_amount_minor,
      input.due_date ?? null,
      input.notes?.trim() ?? null
    ]
  );

  const receivableId = insertResult.rows[0].id;

  // Record any pre-existing collection as an initial payment so the remaining
  // balance math works from day one (e.g. user adds a piutang that is already
  // partially paid).
  if (input.initial_remaining_amount_minor !== undefined && input.initial_remaining_amount_minor < input.total_amount_minor) {
    const initialCollected = input.total_amount_minor - input.initial_remaining_amount_minor;
    await query(
      `insert into receivable_payments (receivable_id, amount_minor, paid_at, notes)
       values ($1, $2, now(), 'Saldo awal terkumpul')`,
      [receivableId, initialCollected]
    );
  }

  return NextResponse.json({ id: receivableId }, { status: 201 });
}
