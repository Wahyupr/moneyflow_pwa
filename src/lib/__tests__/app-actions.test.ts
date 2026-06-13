import { describe, expect, it } from "vitest";
import { getAddActionOptions, getDashboardQuickActions, maskAmount } from "../app-actions";

describe("app action helpers", () => {
  it("keeps top up and transfer out of dashboard quick actions", () => {
    expect(getDashboardQuickActions().map((action) => action.id)).toEqual(["manual", "voice", "receipt"]);
    expect(getDashboardQuickActions().map((action) => action.id)).not.toContain("topup");
    expect(getDashboardQuickActions().map((action) => action.id)).not.toContain("transfer");
  });

  it("exposes the center plus action menu in the expected order", () => {
    expect(getAddActionOptions().map((action) => [action.id, action.href])).toEqual([
      ["voice", "/voice-input"],
      ["manual", "/transactions/new"],
      ["receipt", "/ai-transaction-review?source=receipt"],
      ["transfer_proof", "/ai-transaction-review?source=transfer_proof"],
      ["qris", "/ai-transaction-review?source=qris"],
      ["ai_review", "/ai-transaction-review"]
    ]);
  });

  it("masks amounts with asterisks instead of grey blocks", () => {
    expect(maskAmount("Rp 12.345.000")).toBe("*************");
    expect(maskAmount("")).toBe("****");
  });
});
