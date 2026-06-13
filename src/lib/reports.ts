import type { LedgerTransaction } from "./types";

export type MonthlySummary = {
  month: string;
  totals: {
    income_minor: number;
    expense_minor: number;
    net_minor: number;
  };
  by_category: Array<{
    category_id: string | null;
    expense_minor: number;
  }>;
};

export function summarizeMonthly(transactions: LedgerTransaction[], month: string): MonthlySummary {
  const categoryTotals = new Map<string, number>();

  const totals = transactions
    .filter((transaction) => transaction.occurred_at.startsWith(month))
    .filter((transaction) => !isInternalTransferLeg(transaction))
    .reduce(
      (summary, transaction) => {
        if (transaction.transaction_type === "income") {
          summary.income_minor += Math.abs(transaction.amount_minor);
        }

        if (transaction.transaction_type === "expense") {
          const amount = Math.abs(transaction.amount_minor);
          summary.expense_minor += amount;
          categoryTotals.set(transaction.category_id ?? "uncategorized", (categoryTotals.get(transaction.category_id ?? "uncategorized") ?? 0) + amount);
        }

        return summary;
      },
      { income_minor: 0, expense_minor: 0 }
    );

  return {
    month,
    totals: {
      income_minor: totals.income_minor,
      expense_minor: totals.expense_minor,
      net_minor: totals.income_minor - totals.expense_minor
    },
    by_category: [...categoryTotals.entries()].map(([categoryId, expenseMinor]) => ({
      category_id: categoryId === "uncategorized" ? null : categoryId,
      expense_minor: expenseMinor
    }))
  };
}

function isInternalTransferLeg(transaction: LedgerTransaction): boolean {
  return transaction.transaction_type === "transfer" || transaction.transfer_pair_id !== null;
}
