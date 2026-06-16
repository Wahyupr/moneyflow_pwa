import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { buildArchivedWalletUpdate, validateWalletInput } from "@/lib/wallets";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await context.params;
  const { data, error } = await auth.db
    .from("wallets")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .is("archived_at", null)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Wallet not found." }, { status: 404 });
  }

  return NextResponse.json({ wallet: data });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const parsed = validateWalletInput(await request.json().catch(() => ({})));

  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid wallet payload.", errors: parsed.errors }, { status: 400 });
  }

  const { id } = await context.params;
  const { data, error } = await auth.db
    .from("wallets")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .is("archived_at", null)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Wallet not found." }, { status: 404 });
  }

  return NextResponse.json({ wallet: data });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await context.params;
  const { data, error } = await auth.db
    .from("wallets")
    .update(buildArchivedWalletUpdate(new Date().toISOString()))
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .is("archived_at", null)
    .select("id, archived_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Wallet not found." }, { status: 404 });
  }

  return NextResponse.json({ wallet: data });
}
