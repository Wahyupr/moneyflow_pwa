import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";

export const runtime = "nodejs";

const PatchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    amount_minor: z.number().int().positive().optional(),
    wallet_id: z.string().uuid().optional(),
    category_id: z.string().uuid().nullable().optional(),
    frequency: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
    next_run_at: z.string().datetime().optional(),
    remind_days_before: z.number().int().min(0).max(30).optional(),
    is_active: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Tidak ada perubahan." });

/** PATCH → update reminder fields. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) {
    return auth.response;
  }
  const { id } = await params;

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("recurring_rules")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ reminder: data });
}

/** DELETE → archive (set is_active=false) so we don't blow away history. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) {
    return auth.response;
  }
  const { id } = await params;

  const { error } = await auth.supabase
    .from("recurring_rules")
    .update({ is_active: false })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
