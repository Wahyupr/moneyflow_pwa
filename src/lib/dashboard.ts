import { summarizeMonthly } from "@/lib/reports";
import { stitchTheme } from "@/lib/stitch-theme";
import type { ExtractionDraft, LedgerTransaction } from "@/lib/types";

export type DashboardWallet = {
  id: string;
  name: string;
  type: string;
  balance_minor: number;
  income_minor: number;
  expense_minor: number;
  color: string;
  icon: string;
  shared: boolean;
};

export type DashboardDraft = {
  id: string;
  draft: ExtractionDraft;
};

export type DashboardBudget = {
  id: string;
  name: string;
  used_minor: number;
  limit_minor: number;
  color: string;
};

export type DashboardDelta = {
  /** Rounded percentage change versus the previous month. */
  percent: number;
  /** Whether the change should be rendered with the positive (green) tone. */
  positive: boolean;
};

function previousMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 2, 1));
  return date.toISOString().slice(0, 7);
}

function deltaPercent(current: number, previous: number): number {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }

  return Math.round(((current - previous) / previous) * 100);
}

export function buildDashboardViewModel(input: {
  month: string;
  wallets: DashboardWallet[];
  transactions: LedgerTransaction[];
  drafts: DashboardDraft[];
  privacyEnabled: boolean;
  /** Optional list of active budgets with usage already computed. */
  budgets?: DashboardBudget[];
  /** Optional prior-month transactions used to compute income/expense deltas. */
  previousTransactions?: LedgerTransaction[];
}) {
  const monthly = summarizeMonthly(input.transactions, input.month);
  const previous = summarizeMonthly(input.previousTransactions ?? [], previousMonth(input.month));
  const totalBalance = input.wallets.reduce((sum, wallet) => sum + wallet.balance_minor, 0);

  const incomeDeltaPercent = deltaPercent(monthly.totals.income_minor, previous.totals.income_minor);
  const expenseDeltaPercent = deltaPercent(monthly.totals.expense_minor, previous.totals.expense_minor);

  // Income is "good" when it grows (>= 0). Expense is "good" when it does not
  // grow (delta <= 0): green if <= 0%, red when it climbs above 0%.
  const incomeDelta: DashboardDelta = { percent: incomeDeltaPercent, positive: incomeDeltaPercent >= 0 };
  const expenseDelta: DashboardDelta = { percent: expenseDeltaPercent, positive: expenseDeltaPercent <= 0 };

  return {
    month: input.month,
    total_balance_minor: totalBalance,
    wallets: input.wallets,
    budgets: input.budgets ?? [],
    income_delta: incomeDelta,
    expense_delta: expenseDelta,
    recent_transactions: input.transactions
      .filter((transaction) => !transaction.transfer_pair_id)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
      .slice(0, 5),
    ai_review_queue: input.drafts.filter((item) => item.draft.needs_review),
    monthly,
    insight: {
      title: "Insight Bulanan",
      severity: expenseDeltaPercent > 10 ? "warning" : "info",
      message:
        expenseDeltaPercent > 10
          ? `Pengeluaran naik ${expenseDeltaPercent}% dari bulan lalu.`
          : "Arus kas bulan ini terkendali."
    },
    privacy: {
      enabled: input.privacyEnabled,
      maskColor: stitchTheme.colors.privacyMask
    }
  };
}
