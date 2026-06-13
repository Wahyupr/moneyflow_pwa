import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { canCreateWallet } from "@/lib/entitlements";
import { validateWalletInput } from "@/lib/wallets";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { data, error } = await auth.supabase
    .from("wallets")
    .select("*")
    .eq("user_id", auth.user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: true });


  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wallets: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const parsed = validateWalletInput(await request.json().catch(() => ({})));

  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid wallet payload.", errors: parsed.errors }, { status: 400 });
  }

  const { count } = await auth.supabase
    .from("wallets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id);
  const { data: entitlement } = await auth.supabase
    .from("subscription_entitlements")
    .select("plan")
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .maybeSingle();
  const limit = canCreateWallet({ plan: entitlement?.plan === "premium" ? "premium" : "free", walletCount: count ?? 0 });

  if (!limit.ok) {
    return NextResponse.json({ error: limit.reason }, { status: 402 });
  }

  const { data, error } = await auth.supabase
    .from("wallets")
    .insert({ ...parsed.data, user_id: auth.user.id })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wallet: data }, { status: 201 });
}
