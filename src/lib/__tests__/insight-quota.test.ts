import { describe, expect, it } from "vitest";
import {
  FREE_PLAN_INSIGHT_LIMIT,
  canRegenerateInsight,
  decideInsightQuota,
  isFreeLimitReached
} from "../insight-quota";

describe("FREE_PLAN_INSIGHT_LIMIT", () => {
  it("is 1 (one lifetime insight for free users)", () => {
    expect(FREE_PLAN_INSIGHT_LIMIT).toBe(1);
  });
});

describe("decideInsightQuota", () => {
  it("allows generation for free user with zero usage", () => {
    expect(decideInsightQuota({ plan: "free", usageCount: 0 }).allowed).toBe(true);
  });

  it("blocks generation for free user who has used their lifetime quota", () => {
    const decision = decideInsightQuota({ plan: "free", usageCount: 1 });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe("free_limit_reached");
      expect(decision.plan).toBe("free");
      expect(decision.usageCount).toBe(1);
      expect(decision.freeLimit).toBe(FREE_PLAN_INSIGHT_LIMIT);
    }
  });

  it("blocks generation for free user who has exceeded the quota", () => {
    expect(decideInsightQuota({ plan: "free", usageCount: 5 }).allowed).toBe(false);
  });

  it("always allows generation for premium users regardless of usage", () => {
    expect(decideInsightQuota({ plan: "premium", usageCount: 0 }).allowed).toBe(true);
    expect(decideInsightQuota({ plan: "premium", usageCount: 100 }).allowed).toBe(true);
  });
});

describe("canRegenerateInsight", () => {
  it("returns false for free users", () => {
    expect(canRegenerateInsight("free")).toBe(false);
  });

  it("returns true for premium users", () => {
    expect(canRegenerateInsight("premium")).toBe(true);
  });
});

describe("isFreeLimitReached", () => {
  it("returns false for free user under the limit", () => {
    expect(isFreeLimitReached({ plan: "free", usageCount: 0 })).toBe(false);
  });

  it("returns true for free user at the limit", () => {
    expect(isFreeLimitReached({ plan: "free", usageCount: 1 })).toBe(true);
  });

  it("returns false for premium users regardless of usage", () => {
    expect(isFreeLimitReached({ plan: "premium", usageCount: 100 })).toBe(false);
  });
});
