import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";

export const runtime = "nodejs";

/**
 * Lists categories available to the signed-in user for the manual transaction
 * form: the global/system categories managed by admins. Restricted to
 * authenticated users.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);

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
