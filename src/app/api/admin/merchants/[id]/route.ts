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

const MerchantUpdateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    logo_url: logoReference.optional(),
    website_url: websiteReference.optional(),
    category_id: z.string().uuid().optional().nullable()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No fields to update." });

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAdmin(request);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const parsed = MerchantUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid merchant payload." }, { status: 400 });
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (parsed.data.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(parsed.data.name.trim());
  }
  if (parsed.data.logo_url !== undefined) {
    fields.push(`logo_url = $${idx++}`);
    values.push(parsed.data.logo_url || null);
  }
  if (parsed.data.website_url !== undefined) {
    fields.push(`website_url = $${idx++}`);
    values.push(parsed.data.website_url || null);
  }
  if (parsed.data.category_id !== undefined) {
    fields.push(`category_id = $${idx++}`);
    values.push(parsed.data.category_id ?? null);
  }

  values.push(id);

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
      `update merchants
       set ${fields.join(", ")}
       where id = $${idx} and is_system = true
       returning id, name, logo_url, website_url, category_id, is_system, created_at`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Merchant not found." }, { status: 404 });
    }

    return NextResponse.json({ merchant: result.rows[0] });
  } catch (err) {
    console.error("[admin/merchants PATCH]", err);
    return NextResponse.json({ error: "Failed to update merchant." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAdmin(request);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;

  try {
    const result = await query(
      `delete from merchants where id = $1 and is_system = true`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Merchant not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/merchants DELETE]", err);
    return NextResponse.json({ error: "Failed to delete merchant." }, { status: 500 });
  }
}
