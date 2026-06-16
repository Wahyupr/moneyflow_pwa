/**
 * Pure helpers for the daily-insight free/premium quota model.
 *
 * Extracted from the route handler so the rules can be unit-tested without
 * a database. The route handler is the only place that should call these —
 * UI components consume the resulting decisions via the API response.
 */

export type InsightPlanTier = "free" | "premium";

/**
 * Free plan lifetime insight quota. Premium is unlimited.
 */
export const FREE_PLAN_INSIGHT_LIMIT = 1;

export type QuotaDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: "free_limit_reached";
      plan: InsightPlanTier;
      usageCount: number;
      freeLimit: number;
    };

export function decideInsightQuota(input: {
  plan: InsightPlanTier;
  usageCount: number;
}): QuotaDecision {
  if (input.plan === "free" && input.usageCount >= FREE_PLAN_INSIGHT_LIMIT) {
    return {
      allowed: false,
      reason: "free_limit_reached",
      plan: "free",
      usageCount: input.usageCount,
      freeLimit: FREE_PLAN_INSIGHT_LIMIT
    };
  }
  return { allowed: true };
}

export function canRegenerateInsight(plan: InsightPlanTier): boolean {
  return plan === "premium";
}

export function isFreeLimitReached(input: {
  plan: InsightPlanTier;
  usageCount: number;
}): boolean {
  return input.plan === "free" && input.usageCount >= FREE_PLAN_INSIGHT_LIMIT;
}
