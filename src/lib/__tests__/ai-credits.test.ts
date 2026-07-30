import { describe, expect, it } from "vitest";

import { decideCredit, resolveCycleStart, cycleEnd, CREDIT_CYCLE_DAYS } from "../ai-credits";

describe("decideCredit", () => {
  it("allows any action for unlimited allowance", () => {
    const d = decideCredit({ allowance: null, usedThisCycle: 9999, cost: 5 });
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.remaining).toBeNull();
  });

  it("allows when enough credits remain and reports the new remaining", () => {
    const d = decideCredit({ allowance: 50, usedThisCycle: 40, cost: 5 });
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.remaining).toBe(5);
  });

  it("allows spending down to exactly zero", () => {
    const d = decideCredit({ allowance: 50, usedThisCycle: 45, cost: 5 });
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.remaining).toBe(0);
  });

  it("rejects when the cost exceeds the remaining balance", () => {
    const d = decideCredit({ allowance: 50, usedThisCycle: 48, cost: 5 });
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.reason).toBe("insufficient_credits");
      expect(d.remaining).toBe(2);
      expect(d.allowance).toBe(50);
    }
  });

  it("clamps a negative remaining to zero in the rejection", () => {
    const d = decideCredit({ allowance: 50, usedThisCycle: 60, cost: 1 });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.remaining).toBe(0);
  });
});

describe("resolveCycleStart", () => {
  const day = 24 * 60 * 60 * 1000;

  it("keeps the anchor when still inside the first cycle", () => {
    const anchor = "2026-01-01T00:00:00.000Z";
    const now = new Date("2026-01-10T00:00:00.000Z");
    expect(resolveCycleStart(anchor, now).toISOString()).toBe(anchor);
  });

  it("advances by whole cycles once elapsed exceeds the window", () => {
    const anchor = "2026-01-01T00:00:00.000Z";
    // 35 days later → one full 30-day cycle has passed.
    const now = new Date(new Date(anchor).getTime() + 35 * day);
    const start = resolveCycleStart(anchor, now);
    expect(start.toISOString()).toBe(new Date(new Date(anchor).getTime() + 30 * day).toISOString());
  });

  it("advances multiple cycles for long-idle anchors", () => {
    const anchor = "2026-01-01T00:00:00.000Z";
    const now = new Date(new Date(anchor).getTime() + 95 * day); // 3 cycles + 5 days
    const start = resolveCycleStart(anchor, now);
    expect(start.toISOString()).toBe(new Date(new Date(anchor).getTime() + 90 * day).toISOString());
  });
});

describe("cycleEnd", () => {
  it("is exactly CREDIT_CYCLE_DAYS after the start", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = cycleEnd(start);
    expect(end.getTime() - start.getTime()).toBe(CREDIT_CYCLE_DAYS * 24 * 60 * 60 * 1000);
  });
});
