import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/api/auth";

export const runtime = "nodejs";

const CategoryCreateSchema = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().min(1).max(60),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a hex value like #C8FF00."),
  type: z.enum(["expense", "income"])
});

/**
 * Lists system categories so the admin merchant form can assign a merchant to a
 * global category. Restricted to admins.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { data, error } = await auth.db
    .from("categories")
    .select("id,name,icon,color,type,is_system")
    .eq("is_system", true)
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ categories: data ?? [] });
}

/**
 * Creates a new global (system) category. Restricted to admins.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin(request);

  if ("response" in auth) {
    return auth.response;
  }

  const parsed = CategoryCreateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category payload." }, { status: 400 });
  }

  const { data, error } = await auth.db
    .from("categories")
    .insert({
      name: parsed.data.name.trim(),
      icon: parsed.data.icon.trim(),
      color: parsed.data.color,
      type: parsed.data.type,
      is_system: true
    })
    .select("id,name,icon,color,type,is_system")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ category: data }, { status: 201 });
}
