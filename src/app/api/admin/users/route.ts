import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/api/auth";

export const runtime = "nodejs";

const SubscriptionPatchSchema = z.object({
  user_id: z.string().uuid(),
  plan: z.enum(["free", "premium"]),
  status: z.enum(["active", "past_due", "canceled"]).optional()
});

export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin(request);

  if ("response" in auth) {
    return auth.response;
  }

  const [{ data: profiles, error: profilesError }, { data: entitlements, error: entitlementsError }] = await Promise.all([
    auth.supabase.from("profiles").select("id,display_name,role,default_currency,created_at").order("created_at", { ascending: false }),
    auth.supabase.from("subscription_entitlements").select("user_id,plan,status,current_period_end")
  ]);

  if (profilesError || entitlementsError) {
    return NextResponse.json({ error: profilesError?.message ?? entitlementsError?.message }, { status: 500 });
  }

  const entitlementByUser = new Map((entitlements ?? []).map((item) => [item.user_id, item]));
  const users = (profiles ?? []).map((profile) => ({
    ...profile,
    entitlement: entitlementByUser.get(profile.id) ?? { plan: "free", status: "active", current_period_end: null }
  }));

  return NextResponse.json({ users });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiAdmin(request);

  if ("response" in auth) {
    return auth.response;
  }

  const parsed = SubscriptionPatchSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription payload." }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("subscription_entitlements")
    .upsert(
      {
        user_id: parsed.data.user_id,
        plan: parsed.data.plan,
        status: parsed.data.status ?? "active"
      },
      { onConflict: "user_id" }
    )
    .select("user_id,plan,status,current_period_end")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entitlement: data });
}
