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
    const [profilesResult, entitlementsResult, allowanceResult, usageResult] = await Promise.all([
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
      ),
      // Per-plan credit allowance (null = unlimited). Ignored if table missing.
      query<{ plan: string; ai_credits_per_cycle: number | null }>(
        `select plan, ai_credits_per_cycle from plan_limits`
      ).catch(() => ({ rows: [] as Array<{ plan: string; ai_credits_per_cycle: number | null }> })),
      // Credits used in the last 30 days per user. Ignored if table missing.
      query<{ user_id: string; used: string }>(
        `select user_id, coalesce(sum(credits), 0)::text as used
         from ai_credit_ledger
         where created_at >= now() - interval '30 days'
         group by user_id`
      ).catch(() => ({ rows: [] as Array<{ user_id: string; used: string }> }))
    ]);

    const entitlementByUser = new Map(
      entitlementsResult.rows.map((item) => [item.user_id, item])
    );
    const allowanceByPlan = new Map(
      allowanceResult.rows.map((r) => [r.plan, r.ai_credits_per_cycle])
    );
    const usedByUser = new Map(
      usageResult.rows.map((r) => [r.user_id, Number(r.used)])
    );

    const users = profilesResult.rows.map((profile) => {
      const entitlement = entitlementByUser.get(profile.id) ?? {
        plan: "free",
        status: "active",
        current_period_end: null
      };
      const expired =
        entitlement.current_period_end !== null &&
        new Date(entitlement.current_period_end) <= new Date();
      const effectivePlan = expired ? "free" : entitlement.plan;
      const allowance = allowanceByPlan.has(effectivePlan)
        ? allowanceByPlan.get(effectivePlan) ?? null
        : null;
      const used = usedByUser.get(profile.id) ?? 0;
      return {
        ...profile,
        entitlement,
        credits: {
          allowance, // null = unlimited
          used,
          remaining: allowance === null ? null : Math.max(0, allowance - used)
        }
      };
    });

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
