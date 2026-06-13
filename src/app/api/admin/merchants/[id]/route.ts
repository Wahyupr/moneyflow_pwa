import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/api/auth";

export const runtime = "nodejs";

const MerchantUpdateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    logo_url: z.string().url().max(2048).optional().or(z.literal("")),
    category_id: z.string().uuid().optional().nullable()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No fields to update." });

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAdmin(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsed = MerchantUpdateSchema.safeParse(await request.json().catch(() => null));


  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid merchant payload." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) {
    patch.name = parsed.data.name.trim();
  }
  if (parsed.data.logo_url !== undefined) {
    patch.logo_url = parsed.data.logo_url ? parsed.data.logo_url : null;
  }
  if (parsed.data.category_id !== undefined) {
    patch.category_id = parsed.data.category_id ?? null;
  }

  const { data, error } = await auth.supabase
    .from("merchants")
    .update(patch)
    .eq("id", id)
    .eq("is_system", true)

    .select("id,name,logo_url,category_id,is_system,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ merchant: data });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAdmin(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await context.params;
  const { error } = await auth.supabase.from("merchants").delete().eq("id", id).eq("is_system", true);


  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
