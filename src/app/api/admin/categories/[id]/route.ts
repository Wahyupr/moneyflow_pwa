import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/api/auth";

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

  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await context.params;
  const parsed = CategoryUpdateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category payload." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) {
    patch.name = parsed.data.name.trim();
  }
  if (parsed.data.icon !== undefined) {
    patch.icon = parsed.data.icon.trim();
  }
  if (parsed.data.color !== undefined) {
    patch.color = parsed.data.color;
  }
  if (parsed.data.type !== undefined) {
    patch.type = parsed.data.type;
  }

  const { data, error } = await auth.db
    .from("categories")
    .update(patch)
    .eq("id", id)
    .eq("is_system", true)
    .select("id,name,icon,color,type,is_system")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ category: data });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireApiAdmin(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await context.params;
  const { error } = await auth.db.from("categories").delete().eq("id", id).eq("is_system", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
