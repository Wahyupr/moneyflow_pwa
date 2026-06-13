import { summarizeMonthly } from "@/lib/reports";
import { buildDashboardViewModel } from "@/lib/dashboard";
import type { ExtractionDraft, LedgerTransaction } from "@/lib/types";

export const wallets = [
  {
    id: "wallet-cc",
    name: "CC BCA",
    type: "credit_card",
    balance_minor: -2_100_000,
    income_minor: 0,
    expense_minor: 2_100_000,
    color: "#163E67",
    icon: "credit-card",
    shared: false
  },
  {
    id: "wallet-gopay",
    name: "GoPay",
    type: "ewallet",
    balance_minor: 450_000,
    income_minor: 800_000,
    expense_minor: 350_000,
    color: "#006B7A",
    icon: "smartphone",
    shared: false
  },
  {
    id: "wallet-wedding",
    name: "Tabungan Nikah",
    type: "savings",
    balance_minor: 12_000_000,
    income_minor: 2_000_000,
    expense_minor: 500_000,
    color: "#3E4F23",
    icon: "users",
    shared: true
  },
  {
    id: "wallet-kitchen",
    name: "Kas Dapur",
    type: "cash",
    balance_minor: 800_000,
    income_minor: 1_000_000,
    expense_minor: 200_000,
    color: "#63311F",
    icon: "wallet",
    shared: false
  }
];

export const transactions: LedgerTransaction[] = [
  {
    id: "trx-netflix",
    user_id: "demo-user",
    wallet_id: "wallet-cc",
    category_id: "subscription",
    merchant_name: "Netflix",
    payment_method: "CC BCA",
    transaction_type: "expense",
    amount_minor: 55_000,
    currency: "IDR",
    occurred_at: "2026-06-12T08:15:00.000Z",
    transfer_pair_id: null
  },
  {
    id: "trx-kopi",
    user_id: "demo-user",
    wallet_id: "wallet-gopay",
    category_id: "food",
    merchant_name: "Kopi Kenangan",
    payment_method: "GoPay",
    transaction_type: "expense",
    amount_minor: 38_000,
    currency: "IDR",
    occurred_at: "2026-06-12T04:20:00.000Z",
    transfer_pair_id: null
  },
  {
    id: "trx-salary",
    user_id: "demo-user",
    wallet_id: "wallet-cc",
    category_id: "income",
    merchant_name: "Gaji",
    payment_method: "Transfer Masuk",
    transaction_type: "income",
    amount_minor: 8_500_000,
    currency: "IDR",
    occurred_at: "2026-06-01T02:00:00.000Z",
    transfer_pair_id: null
  },
  {
    id: "trx-transfer-out",
    user_id: "demo-user",
    wallet_id: "wallet-cc",
    category_id: "transfer",
    merchant_name: "Transfer ke GoPay",
    payment_method: "Internal",
    transaction_type: "expense",
    amount_minor: 250_000,
    currency: "IDR",
    occurred_at: "2026-06-10T03:00:00.000Z",
    transfer_pair_id: "pair-demo"
  },
  {
    id: "trx-transfer-in",
    user_id: "demo-user",
    wallet_id: "wallet-gopay",
    category_id: "transfer",
    merchant_name: "Top Up dari CC BCA",
    payment_method: "Internal",
    transaction_type: "income",
    amount_minor: 250_000,
    currency: "IDR",
    occurred_at: "2026-06-10T03:00:02.000Z",
    transfer_pair_id: "pair-demo"
  }
];

export const previousMonthTransactions: LedgerTransaction[] = [
  {
    id: "trx-prev-salary",
    user_id: "demo-user",
    wallet_id: "wallet-cc",
    category_id: "income",
    merchant_name: "Gaji",
    payment_method: "Transfer Masuk",
    transaction_type: "income",
    amount_minor: 8_100_000,
    currency: "IDR",
    occurred_at: "2026-05-01T02:00:00.000Z",
    transfer_pair_id: null
  },
  {
    id: "trx-prev-food",
    user_id: "demo-user",
    wallet_id: "wallet-gopay",
    category_id: "food",
    merchant_name: "Belanja Bulanan",
    payment_method: "GoPay",
    transaction_type: "expense",
    amount_minor: 95_000,
    currency: "IDR",
    occurred_at: "2026-05-18T04:20:00.000Z",
    transfer_pair_id: null
  }
];

export const budgets = [
  { id: "food", name: "Makan", used_minor: 1_350_000, limit_minor: 2_000_000, color: "#FF6B35" },
  { id: "transport", name: "Transport", used_minor: 420_000, limit_minor: 900_000, color: "#58A6FF" },
  { id: "subscription", name: "Subscription", used_minor: 290_000, limit_minor: 400_000, color: "#B891FF" }
];

export const extractionDrafts: Array<{ id: string; draft: ExtractionDraft }> = [
  {
    id: "draft-qris-001",
    draft: {
      document_type: "qris",
      transaction_type: "expense",
      amount_minor: 42_000,
      currency: "IDR",
      occurred_at: "2026-06-12T06:10:00.000Z",
      merchant_name: "Warung Makan Sari",
      counterparty_name: null,
      payment_method: "QRIS",
      reference_number: "QR-1288-7781",
      line_items: [],
      confidence: 0.68,
      needs_review: true,
      warnings: ["Nominal terbaca jelas, merchant perlu konfirmasi."]
    }
  }
];

export const monthlySummary = summarizeMonthly(transactions, "2026-06");
export const dashboardModel = buildDashboardViewModel({
  month: "2026-06",
  wallets,
  transactions,
  drafts: extractionDrafts,
  privacyEnabled: false,
  previousTransactions: previousMonthTransactions
});
