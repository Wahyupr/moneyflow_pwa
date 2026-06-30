import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const SubscriptionPatchSchema = z.object({
  user_id: z.string().uuid(),
  plan: z.enum(["free", "premium", "pro"]),
  status: z.enum(["active", "past_due", "canceled"]).optional()
});

export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin(request);
  if ("response" in auth) return auth.response;

  try {
    const [profilesResult, entitlementsResult] = await Promise.all([
      query<{
        id: string;
        display_name: string | null;
        role: string;
        default_currency: string;
        created_at: string;
      }>(
        `select id, display_name, role, default_currency, created_at
         from profiles
         order by created_at desc`
      ),
      query<{
        user_id: string;
        plan: string;
        status: string;
        current_period_end: string | null;
      }>(
        `select user_id, plan, status, current_period_end
         from subscription_entitlements`
      )
    ]);

    const entitlementByUser = new Map(
      entitlementsResult.rows.map((item) => [item.user_id, item])
    );

    const users = profilesResult.rows.map((profile) => ({
      ...profile,
      entitlement: entitlementByUser.get(profile.id) ?? {
        plan: "free",
        status: "active",
        current_period_end: null
      }
    }));

    return NextResponse.json({ users });
  } catch (err) {
    console.error("[admin/users GET]", err);
    return NextResponse.json({ error: "Failed to fetch users." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiAdmin(request);
  if ("response" in auth) return auth.response;

  const parsed = SubscriptionPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription payload." }, { status: 400 });
  }

  try {
    const result = await query<{
      user_id: string;
      plan: string;
      status: string;
      current_period_end: string | null;
    }>(
      `insert into subscription_entitlements (user_id, plan, status, current_period_end)
       values ($1, $2, $3, null)
       on conflict (user_id)
       do update set
         plan = excluded.plan,
         status = excluded.status,
         current_period_end = null
       returning user_id, plan, status, current_period_end`,
      [
        parsed.data.user_id,
        parsed.data.plan,
        parsed.data.status ?? "active",
      ]
    );

    return NextResponse.json({ entitlement: result.rows[0] });
  } catch (err) {
    console.error("[admin/users PATCH]", err);
    return NextResponse.json({ error: "Failed to update subscription." }, { status: 500 });
  }
}
