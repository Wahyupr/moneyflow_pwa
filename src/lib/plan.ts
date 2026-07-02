import { query } from "@/lib/db/pool";
import type { PlanTier } from "@/lib/types";

/**
 * Returns the user's active plan tier.
 * Falls back to "free" if no active entitlement exists or the trial has expired.
 */
export async function getActivePlan(userId: string): Promise<PlanTier> {
  const result = await query<{ plan: PlanTier }>(
    `select plan
     from subscription_entitlements
     where user_id = $1
       and status = 'active'
       and (current_period_end is null or current_period_end > now())
     order by
       case plan when 'pro' then 0 when 'premium' then 1 else 2 end
     limit 1`,
    [userId]
  );
  return result.rows[0]?.plan ?? "free";
}
