import { describe, expect, it } from "vitest";
import { buildDashboardViewModel } from "../dashboard";
import type { ExtractionDraft, LedgerTransaction } from "../types";

const transactions: LedgerTransaction[] = [
  {
    id: "income",
    user_id: "user-a",
    wallet_id: "wallet-a",
    category_id: "income",
    merchant_name: "Gaji",
    payment_method: "Transfer Masuk",
    transaction_type: "income",
    amount_minor: 8_500_000,
    currency: "IDR",
    occurred_at: "2026-06-01T01:00:00.000Z",
    transfer_pair_id: null
  },
  {
    id: "expense",
    user_id: "user-a",
    wallet_id: "wallet-a",
    category_id: "food",
    merchant_name: "Kopi Kenangan",
    payment_method: "GoPay",
    transaction_type: "expense",
    amount_minor: 38_000,
    currency: "IDR",
    occurred_at: "2026-06-12T04:00:00.000Z",
    transfer_pair_id: null
  },
  {
    id: "transfer",
    user_id: "user-a",
    wallet_id: "wallet-a",
    category_id: "transfer",
    merchant_name: "Transfer internal",
    payment_method: "Internal",
    transaction_type: "expense",
    amount_minor: 250_000,
    currency: "IDR",
    occurred_at: "2026-06-12T05:00:00.000Z",
    transfer_pair_id: "pair-a"
  }
];

const draft: ExtractionDraft = {
  document_type: "qris",
  transaction_type: "expense",
  amount_minor: 42_000,
  currency: "IDR",
  occurred_at: "2026-06-12T06:00:00.000Z",
  merchant_name: "Warung Makan Sari",
  counterparty_name: null,
  payment_method: "QRIS",
  reference_number: "QR-001",
  line_items: [],
  confidence: 0.68,
  needs_review: true,
  warnings: ["Low confidence extraction. Please review all fields."]
};

describe("Stitch dashboard view model", () => {
  it("builds a dashboard model with transfer-safe monthly insight and AI review queue", () => {
    const model = buildDashboardViewModel({
      month: "2026-06",
      wallets: [
        {
          id: "wallet-a",
          name: "GoPay",
          type: "ewallet",
          balance_minor: 450_000,
          income_minor: 800_000,
          expense_minor: 350_000,
          color: "#006B7A",
          icon: "smartphone",
          shared: false
        }
      ],
      transactions,
      drafts: [{ id: "draft-a", draft }],
      privacyEnabled: true
    });

    expect(model.total_balance_minor).toBe(450_000);
    expect(model.monthly.totals.expense_minor).toBe(38_000);
    expect(model.ai_review_queue).toHaveLength(1);
    expect(model.privacy.maskColor).toBe("#E2E8F0");
  });
});
