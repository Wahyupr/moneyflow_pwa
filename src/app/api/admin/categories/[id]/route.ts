import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const CategoryUpdateSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    icon: z.string().min(1).max(60).optional(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a hex value like #C8FF00.")
      .optional(),
    type: z.enum(["expense", "income"]).optional()
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No fields to update." });

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAdmin(request);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;
  const parsed = CategoryUpdateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category payload." }, { status: 400 });
  }

  // Build SET clause dynamically
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (parsed.data.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(parsed.data.name.trim());
  }
  if (parsed.data.icon !== undefined) {
    fields.push(`icon = $${idx++}`);
    values.push(parsed.data.icon.trim());
  }
  if (parsed.data.color !== undefined) {
    fields.push(`color = $${idx++}`);
    values.push(parsed.data.color);
  }
  if (parsed.data.type !== undefined) {
    fields.push(`type = $${idx++}`);
    values.push(parsed.data.type);
  }

  values.push(id); // $idx for WHERE id

  try {
    const result = await query<{
      id: string;
      name: string;
      icon: string;
      color: string;
      type: string;
      is_system: boolean;
    }>(
      `update categories
       set ${fields.join(", ")}
       where id = $${idx} and is_system = true
       returning id, name, icon, color, type, is_system`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    return NextResponse.json({ category: result.rows[0] });
  } catch (err) {
    console.error("[admin/categories PATCH]", err);
    return NextResponse.json({ error: "Failed to update category." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAdmin(request);
  if ("response" in auth) return auth.response;

  const { id } = await context.params;

  try {
    const result = await query(
      `delete from categories where id = $1 and is_system = true`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/categories DELETE]", err);
    return NextResponse.json({ error: "Failed to delete category." }, { status: 500 });
  }
}
