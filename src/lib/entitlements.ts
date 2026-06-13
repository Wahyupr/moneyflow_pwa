import type { PlanTier, Result } from "./types";

export function canCreateWallet(input: { plan: PlanTier; walletCount: number }): Result {
  if (input.plan === "free" && input.walletCount >= 2) {
    return { ok: false, reason: "Free plan is limited to 2 wallets." };
  }

  return { ok: true };
}

export function canCreateBudget(input: { plan: PlanTier; activeBudgetCount: number }): Result {
  if (input.plan === "free" && input.activeBudgetCount >= 1) {
    return { ok: false, reason: "Free plan is limited to 1 active budget." };
  }

  return { ok: true };
}

export function getReportWindowStart(input: { plan: PlanTier; now: Date }): string | null {
  if (input.plan === "premium") {
    return null;
  }

  return new Date(Date.UTC(input.now.getUTCFullYear(), input.now.getUTCMonth() - 3, 1)).toISOString().slice(0, 10);
}
