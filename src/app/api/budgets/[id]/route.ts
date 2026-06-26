import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const BudgetPatchSchema = z.object({
  amount_limit_minor: z.number().int().min(1).optional(),
  alert_at_percent: z.number().int().min(1).max(100).optional()
});

// PATCH /api/budgets/[id] — update budget limit or alert threshold
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;

  const parsed = BudgetPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (parsed.data.amount_limit_minor !== undefined) {
    updates.push(`amount_limit_minor = $${idx++}`);
    values.push(parsed.data.amount_limit_minor);
  }
  if (parsed.data.alert_at_percent !== undefined) {
    updates.push(`alert_at_percent = $${idx++}`);
    values.push(parsed.data.alert_at_percent);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  values.push(id, auth.user.id);
  const result = await query<{ id: string }>(
    `update budgets set ${updates.join(", ")}
     where id = $${idx} and user_id = $${idx + 1} and is_active = true
     returning id`,
    values
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Budget not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/budgets/[id] — soft-delete (deactivate) a budget
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;

  const result = await query<{ id: string }>(
    `update budgets set is_active = false
     where id = $1 and user_id = $2 and is_active = true
     returning id`,
    [id, auth.user.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Budget not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
