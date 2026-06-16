import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

/**
 * GET — Returns categories available to the user:
 *   - Global/system categories (is_system = true, user_id = NULL) — visible to everyone.
 *   - The user's own custom categories (user_id = current user) — private.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const rows = await query<{ id: string; name: string; icon: string | null; color: string | null; type: string; is_system: boolean; user_id: string | null }>(
    `select id, name, icon, color, type, is_system, user_id
     from categories
     where is_system = true or user_id = $1
     order by is_system desc, name`,
    [auth.user.id]
  );

  const categories = rows.rows.map((r) => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color,
    type: r.type,
    is_system: r.is_system,
    user_id: r.user_id
  }));

  return NextResponse.json({ categories });
}

const CategoryCreateSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["expense", "income", "transfer"]),
  icon: z.string().max(80).optional(),
  color: z.string().max(30).optional()
});

/**
 * POST — Creates a personal (non-system) category owned by the user.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const parsed = CategoryCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const { data, error } = await auth.db
    .from("categories")
    .insert({
      name: parsed.data.name.trim(),
      type: parsed.data.type,
      icon: parsed.data.icon ?? null,
      color: parsed.data.color ?? null,
      user_id: auth.user.id,
      is_system: false
    })
    .select("id,name,icon,color,type,is_system,user_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data }, { status: 201 });
}

/**
 * DELETE — Removes the user's own custom category. System categories cannot be deleted by regular users.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib diisi." }, { status: 400 });

  // Only allow deleting own (non-system) categories
  const { error } = await auth.db
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .eq("is_system", false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
