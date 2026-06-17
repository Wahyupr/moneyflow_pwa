import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { canAccessHutangPiutang } from "@/lib/entitlements";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const PaymentSchema = z.object({
  amount_minor: z.number().int().positive(),
  paid_at: z.string().datetime().optional(),
  notes: z.string().max(500).nullable().optional()
});

async function requirePremium(userId: string) {
  const result = await query<{ plan: string | null }>(
    "select plan from subscription_entitlements where user_id = $1 and status = 'active'",
    [userId]
  );
  const plan = (result.rows[0]?.plan ?? "free") as "free" | "premium";
  return canAccessHutangPiutang(plan);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const access = await requirePremium(auth.user.id);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 402 });

  const { id } = await params;
  const parsed = PaymentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data pembayaran tidak valid." }, { status: 400 });
  }
  const input = parsed.data;

  const owning = await query<{ total: string; paid: string }>(
    `select d.total_amount_minor::text as total,
            coalesce((select sum(amount_minor) from debt_payments where debt_id = d.id), 0)::text as paid
       from debts d
      where d.id = $1 and d.user_id = $2 and d.status = 'active'`,
    [id, auth.user.id]
  );

  if (owning.rows.length === 0) {
    return NextResponse.json({ error: "Hutang tidak ditemukan." }, { status: 404 });
  }

  await query(
    `insert into debt_payments (debt_id, amount_minor, paid_at, notes)
     values ($1, $2, $3, $4)`,
    [id, input.amount_minor, input.paid_at ?? new Date().toISOString(), input.notes?.trim() ?? null]
  );

  const total = Number(owning.rows[0].total);
  const paid = Number(owning.rows[0].paid) + input.amount_minor;
  if (paid >= total) {
    await query("update debts set status = 'paid' where id = $1", [id]);
  }

  return NextResponse.json(
    { ok: true, paid_amount_minor: paid, remaining_amount_minor: Math.max(0, total - paid) },
    { status: 201 }
  );
}
