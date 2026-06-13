import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";

export const runtime = "nodejs";

const ProfilePatchSchema = z.object({
  display_name: z.string().min(1).max(120).optional(),
  locale: z.string().min(2).max(20).optional(),
  default_currency: z.string().length(3).optional(),
  biometric_enabled: z.boolean().optional(),
  pin_lock_timer: z.enum(["30s", "1m", "5m", "always"]).optional(),
  hide_nominal_default: z.boolean().optional()
});

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const [{ data: profile, error: profileError }, { data: entitlement }] = await Promise.all([
    auth.supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle(),
    auth.supabase
      .from("subscription_entitlements")
      .select("plan,status,current_period_end")
      .eq("user_id", auth.user.id)
      .eq("status", "active")
      .maybeSingle()
  ]);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({
    user: {
      id: auth.user.id,
      email: auth.user.email
    },
    profile,
    entitlement: entitlement ?? { plan: "free", status: "active", current_period_end: null }
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const parsed = ProfilePatchSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile payload." }, { status: 400 });
  }

  const patch = {
    ...parsed.data,
    default_currency: parsed.data.default_currency?.toUpperCase()
  };
  const { data, error } = await auth.supabase
    .from("profiles")
    .upsert({ id: auth.user.id, ...patch }, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
