import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/api/auth";
import { isValidLogoReference } from "@/lib/merchant-logo";
import { query } from "@/lib/db/pool";

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
  if ("response" in auth) return auth.response;

  try {
    const result = await query<{
      id: string;
      name: string;
      logo_url: string | null;
      website_url: string | null;
      category_id: string | null;
      is_system: boolean;
      created_at: string;
    }>(
      `select id, name, logo_url, website_url, category_id, is_system, created_at
       from merchants
       where is_system = true
       order by name`
    );
    return NextResponse.json({ merchants: result.rows });
  } catch (err) {
    console.error("[admin/merchants GET]", err);
    return NextResponse.json({ error: "Failed to fetch merchants." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin(request);
  if ("response" in auth) return auth.response;

  const parsed = MerchantCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid merchant payload." }, { status: 400 });
  }

  try {
    const result = await query<{
      id: string;
      name: string;
      logo_url: string | null;
      website_url: string | null;
      category_id: string | null;
      is_system: boolean;
      created_at: string;
    }>(
      `insert into merchants (name, logo_url, website_url, category_id, is_system, created_by)
       values ($1, $2, $3, $4, true, null)
       returning id, name, logo_url, website_url, category_id, is_system, created_at`,
      [
        parsed.data.name.trim(),
        parsed.data.logo_url || null,
        parsed.data.website_url || null,
        parsed.data.category_id ?? null,
      ]
    );
    return NextResponse.json({ merchant: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[admin/merchants POST]", err);
    return NextResponse.json({ error: "Failed to create merchant." }, { status: 500 });
  }
}
