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

const MerchantUpdateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    logo_url: logoReference.nullable().optional(),
    category_id: z.string().uuid().nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No fields to update." });

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH — Updates the authenticated user's own merchant. System (admin) merchants
 * cannot be edited here. Only fields present in the payload are applied.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const parsed = MerchantUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data merchant tidak valid." }, { status: 400 });
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (parsed.data.name !== undefined) {
    sets.push(`name = $${paramIdx++}`);
    values.push(parsed.data.name.trim());
  }
  if (parsed.data.logo_url !== undefined) {
    sets.push(`logo_url = $${paramIdx++}`);
    values.push(parsed.data.logo_url ? parsed.data.logo_url : null);
  }
  if (parsed.data.category_id !== undefined) {
    sets.push(`category_id = $${paramIdx++}`);
    values.push(parsed.data.category_id ?? null);
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan." }, { status: 400 });
  }

  values.push(id, auth.user.id);

  const result = await query(
    `update merchants
        set ${sets.join(", ")}
      where id = $${paramIdx++}
        and created_by = $${paramIdx++}
        and is_system = false
      returning id, name, logo_url, category_id, is_system, created_at`,
    values
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Merchant tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ merchant: result.rows[0] });
}

/**
 * DELETE — Removes the user's own merchant. System (admin) merchants cannot be deleted here.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;

  const result = await query(
    `delete from merchants
      where id = $1
        and created_by = $2
        and is_system = false`,
    [id, auth.user.id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Merchant tidak ditemukan." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
