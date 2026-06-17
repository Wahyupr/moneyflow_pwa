import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { canAccessHutangPiutang } from "@/lib/entitlements";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  creditor_name: z.string().min(1).max(120),
  category: z.string().min(1).max(80),
  total_amount_minor: z.number().int().positive(),
  initial_remaining_amount_minor: z.number().int().min(0).optional(),
  monthly_installment_minor: z.number().int().positive().nullable().optional(),
  next_due_date: z.string().datetime().nullable().optional(),
  target_paid_off_date: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

type DebtRow = {
  id: string;
  user_id: string;
  name: string;
  creditor_name: string;
  category: string;
  total_amount_minor: string;
  monthly_installment_minor: string | null;
  currency: string;
  next_due_date: string | null;
  target_paid_off_date: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  paid_amount_minor: string;
};

async function requirePremium(userId: string) {
  const result = await query<{ plan: string | null }>(
    "select plan from subscription_entitlements where user_id = $1 and status = 'active'",
    [userId]
  );
  const plan = (result.rows[0]?.plan ?? "free") as "free" | "premium";
  return canAccessHutangPiutang(plan);
}

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const access = await requirePremium(auth.user.id);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 402 });

  const result = await query<DebtRow>(
    `select d.*, coalesce(p.paid, 0) as paid_amount_minor
       from debts d
       left join (
         select debt_id, sum(amount_minor) as paid
           from debt_payments
          group by debt_id
       ) p on p.debt_id = d.id
      where d.user_id = $1 and d.status = 'active'
      order by d.created_at desc`,
    [auth.user.id]
  );

  const rows = result.rows.map((row) => {
    const total = Number(row.total_amount_minor);
    const paid = Number(row.paid_amount_minor);
    return {
      id: row.id,
      name: row.name,
      creditor_name: row.creditor_name,
      category: row.category,
      total_amount_minor: total,
      paid_amount_minor: paid,
      remaining_amount_minor: total - paid,
      monthly_installment_minor: row.monthly_installment_minor == null ? null : Number(row.monthly_installment_minor),
      currency: row.currency,
      next_due_date: row.next_due_date,
      target_paid_off_date: row.target_paid_off_date,
      notes: row.notes,
      status: row.status,
      created_at: row.created_at
    };
  });

  const summary = rows.reduce(
    (acc, row) => {
      acc.total_principal_minor += row.total_amount_minor;
      acc.total_paid_minor += row.paid_amount_minor;
      acc.total_remaining_minor += row.remaining_amount_minor;
      acc.total_monthly_installment_minor += row.monthly_installment_minor ?? 0;
      return acc;
    },
    { total_principal_minor: 0, total_paid_minor: 0, total_remaining_minor: 0, total_monthly_installment_minor: 0 }
  );

  return NextResponse.json({ debts: rows, summary });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const access = await requirePremium(auth.user.id);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 402 });

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data hutang tidak valid." }, { status: 400 });
  }
  const input = parsed.data;

  if (input.initial_remaining_amount_minor !== undefined && input.initial_remaining_amount_minor > input.total_amount_minor) {
    return NextResponse.json({ error: "Sisa awal tidak boleh lebih besar dari total pinjaman." }, { status: 400 });
  }

  const insertResult = await query<{ id: string }>(
    `insert into debts (user_id, name, creditor_name, category, total_amount_minor, monthly_installment_minor, next_due_date, target_paid_off_date, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id`,
    [
      auth.user.id,
      input.name.trim(),
      input.creditor_name.trim(),
      input.category.trim(),
      input.total_amount_minor,
      input.monthly_installment_minor ?? null,
      input.next_due_date ?? null,
      input.target_paid_off_date ?? null,
      input.notes?.trim() ?? null
    ]
  );

  const debtId = insertResult.rows[0].id;

  // If user enters a debt that already has prior payments, record them as a
  // baseline payment so the remaining balance is correct from day one.
  if (input.initial_remaining_amount_minor !== undefined && input.initial_remaining_amount_minor < input.total_amount_minor) {
    const initialPaid = input.total_amount_minor - input.initial_remaining_amount_minor;
    await query(
      `insert into debt_payments (debt_id, amount_minor, paid_at, notes)
       values ($1, $2, now(), 'Saldo awal terbayar')`,
      [debtId, initialPaid]
    );
  }

  return NextResponse.json({ id: debtId }, { status: 201 });
}
