import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { canAccessHutangPiutang } from "@/lib/entitlements";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const PatchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    creditor_name: z.string().min(1).max(120).optional(),
    category: z.string().min(1).max(80).optional(),
    monthly_installment_minor: z.number().int().positive().nullable().optional(),
    next_due_date: z.string().datetime().nullable().optional(),
    target_paid_off_date: z.string().datetime().nullable().optional(),
    notes: z.string().max(2000).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Tidak ada perubahan." });

async function requirePremium(userId: string) {
  const result = await query<{ plan: string | null }>(
    "select plan from subscription_entitlements where user_id = $1 and status = 'active' and (current_period_end is null or current_period_end > now())",
    [userId]
  );
  const plan = (result.rows[0]?.plan ?? "free") as "free" | "premium";
  return canAccessHutangPiutang(plan);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const access = await requirePremium(auth.user.id);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 402 });

  const { id } = await params;
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data hutang tidak valid." }, { status: 400 });
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  const input = parsed.data;
  if (input.name !== undefined) { sets.push(`name = $${idx++}`); values.push(input.name.trim()); }
  if (input.creditor_name !== undefined) { sets.push(`creditor_name = $${idx++}`); values.push(input.creditor_name.trim()); }
  if (input.category !== undefined) { sets.push(`category = $${idx++}`); values.push(input.category.trim()); }
  if (input.monthly_installment_minor !== undefined) { sets.push(`monthly_installment_minor = $${idx++}`); values.push(input.monthly_installment_minor); }
  if (input.next_due_date !== undefined) { sets.push(`next_due_date = $${idx++}`); values.push(input.next_due_date); }
  if (input.target_paid_off_date !== undefined) { sets.push(`target_paid_off_date = $${idx++}`); values.push(input.target_paid_off_date); }
  if (input.notes !== undefined) { sets.push(`notes = $${idx++}`); values.push(input.notes?.trim() ?? null); }
  values.push(id, auth.user.id);

  const result = await query(
    `update debts set ${sets.join(", ")} where id = $${idx++} and user_id = $${idx}`,
    values
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Hutang tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const access = await requirePremium(auth.user.id);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 402 });

  const { id } = await params;
  const result = await query(
    "update debts set status = 'archived' where id = $1 and user_id = $2 and status = 'active'",
    [id, auth.user.id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Hutang tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
