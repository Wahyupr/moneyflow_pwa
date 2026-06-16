import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";

export const runtime = "nodejs";

const MerchantCreateSchema = z.object({
  name: z.string().min(1).max(120),
  category_id: z.string().uuid().nullable().optional()
});

/**
 * Lists merchants the user can pick: global/system ones (admin-managed) plus
 * the user's own merchants. RLS already scopes "own" rows to the caller.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { data, error } = await auth.db
    .from("merchants")
    .select("id,name,logo_url,category_id,is_system")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ merchants: data ?? [] });
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
      is_system: false,
      created_by: auth.user.id
    })
    .select("id,name,logo_url,category_id,is_system")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ merchant: data }, { status: 201 });
}
