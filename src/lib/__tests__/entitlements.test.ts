import { describe, expect, it } from "vitest";
import {
  canCreateBudget,
  canCreateWallet,
  getReportWindowStart
} from "../entitlements";

describe("freemium entitlements", () => {
  it("enforces free wallet and budget limits", () => {
    expect(canCreateWallet({ plan: "free", walletCount: 2 })).toEqual({
      ok: false,
      reason: "Free plan is limited to 2 wallets."
    });
    expect(canCreateWallet({ plan: "premium", walletCount: 25 })).toEqual({ ok: true });
    expect(canCreateBudget({ plan: "free", activeBudgetCount: 1 })).toEqual({
      ok: false,
      reason: "Free plan is limited to 1 active budget."
    });
  });

  it("limits free reports to a 3 month lookback window", () => {
    expect(getReportWindowStart({ plan: "free", now: new Date("2026-06-12T00:00:00.000Z") })).toBe(
      "2026-03-01"
    );
    expect(getReportWindowStart({ plan: "premium", now: new Date("2026-06-12T00:00:00.000Z") })).toBeNull();
  });
});
