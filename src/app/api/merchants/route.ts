import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { isValidLogoReference } from "@/lib/merchant-logo";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const logoReference = z
  .string()
  .max(2048)
  .refine(isValidLogoReference, { message: "Logo harus berupa URL http(s) atau path yang valid." });

const MerchantCreateSchema = z.object({
  name: z.string().min(1).max(120),
  category_id: z.string().uuid().nullable().optional(),
  logo_url: logoReference.nullable().optional()
});

/**
 * Lists merchants the user can pick:
 *   - Global/system merchants (is_system = true, created_by = NULL) — visible to everyone.
 *   - The user's own personal merchants (created_by = current user) — private.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const rows = await query<{ id: string; name: string; logo_url: string | null; category_id: string | null; is_system: boolean; created_by: string | null }>(
    `select id, name, logo_url, category_id, is_system, created_by
     from merchants
     where is_system = true or created_by = $1
     order by is_system desc, name`,
    [auth.user.id]
  );

  return NextResponse.json({ merchants: rows.rows });
}

/**
 * Creates a personal (non-system) merchant owned by the user. Admins manage
 * the global directory separately via /api/admin/merchants.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const parsed = MerchantCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Nama merchant wajib diisi." }, { status: 400 });
  }

  const { data, error } = await auth.db
    .from("merchants")
    .insert({
      name: parsed.data.name.trim(),
      category_id: parsed.data.category_id ?? null,
      logo_url: parsed.data.logo_url ?? null,
      is_system: false,
      created_by: auth.user.id  // user-owned merchants are scoped to creator
    })
    .select("id,name,logo_url,category_id,is_system")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ merchant: data }, { status: 201 });
}

/**
 * DELETE — Removes the user's own merchant. System (admin) merchants cannot be deleted here.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id wajib diisi." }, { status: 400 });

  const { error } = await auth.db
    .from("merchants")
    .delete()
    .eq("id", id)
    .eq("created_by", auth.user.id)
    .eq("is_system", false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
