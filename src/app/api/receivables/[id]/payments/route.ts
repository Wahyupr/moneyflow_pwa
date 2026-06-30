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
    "select plan from subscription_entitlements where user_id = $1 and status = 'active' and (current_period_end is null or current_period_end > now())",
    [userId]
  );
  const plan = (result.rows[0]?.plan ?? "free") as "free" | "premium" | "pro";
  return canAccessHutangPiutang({ plan, recordCount: 0 });
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

  // Verify ownership + fetch current totals so we can auto-flip status when
  // the receivable is fully collected.
  const owning = await query<{ total: string; collected: string }>(
    `select r.total_amount_minor::text as total,
            coalesce((select sum(amount_minor) from receivable_payments where receivable_id = r.id), 0)::text as collected
       from receivables r
      where r.id = $1 and r.user_id = $2 and r.status = 'active'`,
    [id, auth.user.id]
  );

  if (owning.rows.length === 0) {
    return NextResponse.json({ error: "Piutang tidak ditemukan." }, { status: 404 });
  }

  await query(
    `insert into receivable_payments (receivable_id, amount_minor, paid_at, notes)
     values ($1, $2, $3, $4)`,
    [id, input.amount_minor, input.paid_at ?? new Date().toISOString(), input.notes?.trim() ?? null]
  );

  const total = Number(owning.rows[0].total);
  const collected = Number(owning.rows[0].collected) + input.amount_minor;
  if (collected >= total) {
    await query("update receivables set status = 'paid' where id = $1", [id]);
  }

  return NextResponse.json({ ok: true, collected_amount_minor: collected, remaining_amount_minor: Math.max(0, total - collected) }, { status: 201 });
}
