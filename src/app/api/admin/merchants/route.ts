import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/api/auth";
import { isValidLogoReference } from "@/lib/merchant-logo";

export const runtime = "nodejs";

const logoReference = z
  .string()
  .max(2048)
  .refine(isValidLogoReference, { message: "Logo harus berupa URL http(s) atau path yang valid." });

const websiteReference = z
  .string()
  .max(2048)
  .refine((value) => value === "" || isValidLogoReference(value), {
    message: "Link harus berupa URL http(s) yang valid."
  });

const MerchantCreateSchema = z.object({
  name: z.string().min(1).max(120),
  logo_url: logoReference.optional(),
  website_url: websiteReference.optional(),
  category_id: z.string().uuid().optional().nullable()
});

export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { data, error } = await auth.db
    .from("merchants")
    .select("id,name,logo_url,website_url,category_id,is_system,created_at")
    .eq("is_system", true)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ merchants: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin(request);

  if ("response" in auth) {
    return auth.response;
  }

  const parsed = MerchantCreateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid merchant payload." }, { status: 400 });
  }

  const { data, error } = await auth.db
    .from("merchants")
    .insert({
      name: parsed.data.name.trim(),
      logo_url: parsed.data.logo_url ? parsed.data.logo_url : null,
      website_url: parsed.data.website_url ? parsed.data.website_url : null,
      category_id: parsed.data.category_id ?? null,
      is_system: true,
      created_by: auth.user.id
    })
    .select("id,name,logo_url,website_url,category_id,is_system,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ merchant: data }, { status: 201 });
}
