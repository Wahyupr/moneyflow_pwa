import { describe, expect, it } from "vitest";
import { summarizeMonthly } from "../reports";
import type { LedgerTransaction } from "../types";

const base: Omit<LedgerTransaction, "id" | "amount_minor" | "transaction_type" | "occurred_at"> = {
  user_id: "user-a",
  wallet_id: "wallet-a",
  currency: "IDR",
  category_id: "cat-a",
  merchant_name: null,
  payment_method: null,
  transfer_pair_id: null
};

describe("monthly reports", () => {
  it("excludes internal transfer legs from income and expense totals", () => {
    const transactions: LedgerTransaction[] = [
      {
        ...base,
        id: "salary",
        transaction_type: "income",
        amount_minor: 8_500_000,
        occurred_at: "2026-06-01T08:00:00.000Z"
      },
      {
        ...base,
        id: "coffee",
        transaction_type: "expense",
        amount_minor: 38_000,
        occurred_at: "2026-06-02T03:00:00.000Z"
      },
      {
        ...base,
        id: "transfer-out",
        transaction_type: "expense",
        amount_minor: 1_000_000,
        occurred_at: "2026-06-03T03:00:00.000Z",
        transfer_pair_id: "pair-a"
      },
      {
        ...base,
        id: "transfer-in",
        transaction_type: "income",
        amount_minor: 1_000_000,
        occurred_at: "2026-06-03T03:00:02.000Z",
        transfer_pair_id: "pair-a"
      }
    ];

    expect(summarizeMonthly(transactions, "2026-06").totals).toEqual({
      income_minor: 8_500_000,
      expense_minor: 38_000,
      net_minor: 8_462_000
    });
  });
});
