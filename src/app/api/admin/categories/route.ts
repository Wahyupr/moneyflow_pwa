import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

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
  if ("response" in auth) return auth.response;

  try {
    const result = await query<{
      id: string;
      name: string;
      icon: string;
      color: string;
      type: string;
      is_system: boolean;
    }>(
      `select id, name, icon, color, type, is_system
       from categories
       where is_system = true
       order by name`
    );
    return NextResponse.json({ categories: result.rows });
  } catch (err) {
    console.error("[admin/categories GET]", err);
    return NextResponse.json({ error: "Failed to fetch categories." }, { status: 500 });
  }
}

/**
 * Creates a new global (system) category. Restricted to admins.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiAdmin(request);
  if ("response" in auth) return auth.response;

  const parsed = CategoryCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category payload." }, { status: 400 });
  }

  try {
    const result = await query<{
      id: string;
      name: string;
      icon: string;
      color: string;
      type: string;
      is_system: boolean;
    }>(
      `insert into categories (name, icon, color, type, is_system)
       values ($1, $2, $3, $4, true)
       returning id, name, icon, color, type, is_system`,
      [
        parsed.data.name.trim(),
        parsed.data.icon.trim(),
        parsed.data.color,
        parsed.data.type,
      ]
    );
    return NextResponse.json({ category: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[admin/categories POST]", err);
    return NextResponse.json({ error: "Failed to create category." }, { status: 500 });
  }
}
