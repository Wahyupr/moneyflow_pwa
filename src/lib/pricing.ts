// Single source of truth for subscription pricing (monthly-only, IDR).
// Imported by both server (snap route) and client (pricing UI, settings) so
// prices never drift between what the user sees and what they are charged.

export type PaidPlan = "premium" | "pro";
export type CurrentPlan = "free" | "premium" | "pro";

/** Standard monthly list price per plan (IDR, no decimals). */
export const PLAN_PRICE: Record<PaidPlan, number> = {
  premium: 39_000,
  pro: 59_000,
};

/** Discounted price for a free/guest user jumping straight to Pro. */
export const FREE_TO_PRO_PRICE = 49_000;

/** Price for an existing Premium (incl. trial) user upgrading to Pro. */
export const PREMIUM_TO_PRO_PRICE = 20_000;

/**
 * Amount to charge for a checkout, based on the target plan and the user's
 * current active plan. Must be evaluated server-side with the DB-verified
 * current plan — never trust a client-supplied current plan.
 */
export function getCheckoutAmount(target: PaidPlan, currentPlan: CurrentPlan): number {
  if (target === "premium") {
    return PLAN_PRICE.premium;
  }
  // target === "pro"
  if (currentPlan === "premium") {
    // Premium subscribers and trial-Premium users pay only the difference.
    return PREMIUM_TO_PRO_PRICE;
  }
  if (currentPlan === "pro") {
    // Renewing/extending Pro — full Pro price.
    return PLAN_PRICE.pro;
  }
  // free / guest → Pro: discounted.
  return FREE_TO_PRO_PRICE;
}

export function formatRp(n: number): string {
  return "Rp" + n.toLocaleString("id-ID");
}
