import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { createDraftPatch } from "@/lib/drafts";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await context.params;
  const { data, error } = await auth.supabase
    .from("transaction_drafts")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Draft not found." }, { status: 404 });
  }

  return NextResponse.json({ draft: data });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await context.params;
  const { data: existing, error: existingError } = await auth.supabase
    .from("transaction_drafts")
    .select("extracted_json")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .single();

  if (existingError || !existing) {
    return NextResponse.json({ error: existingError?.message ?? "Draft not found." }, { status: 404 });
  }

  const patch = createDraftPatch(await request.json().catch(() => ({})));
  const merged = { ...(existing.extracted_json as Record<string, unknown>), ...patch.extracted_json };
  const { data, error } = await auth.supabase
    .from("transaction_drafts")
    .update({ extracted_json: merged })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Draft not found." }, { status: 404 });
  }

  return NextResponse.json({ draft: data });
}
