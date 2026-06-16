/**
 * Shared report data layer for the personal-finance reports feature.
 *
 * Used by:
 *   - GET /api/reports/summary   (JSON response for the Reports UI)
 *   - GET /api/reports/export    (.xlsx download with the same dataset)
 *
 * Scoping: transactions are filtered by `user_id` (not wallet_id) so the
 * report reflects the user's own recorded activity. Transactions logged by
 * other members in shared wallets do NOT appear here — those belong to the
 * other members' reports.
 */

import type { DatabaseClient } from "@/lib/db/client";
import type { LedgerTransaction, TransactionType } from "@/lib/types";

export type ReportWindow = {
  /** YYYY-MM label of the starting month (used for trend chart anchor). */
  month: string;
  fromIso: string;
  toIso: string;
  /** Whether the window was a custom range vs single calendar month. */
  isCustomRange: boolean;
  /** Caller-friendly description for labels ("Juni 2026" / "1 Jun – 30 Jun 2026"). */
  description: string;
};

export type CategoryBreakdownRow = {
  category_id: string | null;
  category_name: string;
  category_color: string;
  expense_minor: number;
  expense_pct: number;
  transaction_count: number;
};

export type MerchantRow = {
  name: string;
  expense_minor: number;
  transaction_count: number;
  logo_url?: string | null;
};

export type TrendRow = {
  month: string;
  income_minor: number;
  expense_minor: number;
};

export type ReportData = {
  window: ReportWindow;
  totals: {
    income_minor: number;
    expense_minor: number;
    net_minor: number;
    savings_rate_pct: number;
    transaction_count: number;
  };
  previous_totals: {
    income_minor: number;
    expense_minor: number;
    net_minor: number;
  };
  by_category: CategoryBreakdownRow[];
  top_merchants: MerchantRow[];
  trend: TrendRow[];
  transactions: LedgerTransaction[];
  generated_at: string;
};

type ResolveOptions = {
  month?: string | null;
  from?: string | null;
  to?: string | null;
};

function nextMonthIso(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m, 1)).toISOString();
}

function describeWindow(window: ReportWindow): string {
  if (window.isCustomRange) {
    const fmt = (iso: string) => {
      const d = new Date(iso);
      return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    };
    // from is inclusive start-of-day, to is exclusive next-day-of-end; subtract 1 day for label.
    const endLabel = new Date(Date.parse(window.toIso) - 24 * 60 * 60 * 1000).toISOString();
    return `${fmt(window.fromIso)} – ${fmt(endLabel)}`;
  }
  const [y, m] = window.month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

export function resolveReportWindow(options: ResolveOptions): ReportWindow {
  const { month: monthParam, from: fromParam, to: toParam } = options;

  if (fromParam && toParam) {
    const fromIso = `${fromParam}T00:00:00.000Z`;
    const toDate = new Date(`${toParam}T00:00:00.000Z`);
    toDate.setUTCDate(toDate.getUTCDate() + 1);
    const toIso = toDate.toISOString();
    const month = fromParam.slice(0, 7);
    const window: ReportWindow = {
      month,
      fromIso,
      toIso,
      isCustomRange: true,
      description: ""
    };
    window.description = describeWindow(window);
    return window;
  }

  const month = monthParam ?? new Date().toISOString().slice(0, 7);
  const fromIso = `${month}-01T00:00:00.000Z`;
  const toIso = nextMonthIso(month);
  const window: ReportWindow = {
    month,
    fromIso,
    toIso,
    isCustomRange: false,
    description: ""
  };
  window.description = describeWindow(window);
  return window;
}

/**
 * Loads the full report dataset for the given user and window.
 *
 * Performs 5 parallel queries:
 *   1. Transactions in the window (raw rows for Transactions sheet)
 *   2. System + user categories (for category name/color enrichment)
 *   3. All merchants (logo lookup; we skip logos in XLSX but keep for parity)
 *   4. Previous-period totals (for delta)
 *   5. 6-month trend ending at the window's month
 */
export async function fetchReportData(
  db: DatabaseClient,
  userId: string,
  window: ReportWindow
): Promise<ReportData> {
  const [
    { data: txRows, error: txError },
    { data: systemCategories },
    { data: userCategories },
    { data: merchants }
  ] = await Promise.all([
    db
      .from("transactions")
      .select(
        "id,user_id,wallet_id,category_id,merchant_name,payment_method,transaction_type,amount_minor,currency,occurred_at,transfer_pair_id"
      )
      .eq("user_id", userId)
      .gte("occurred_at", window.fromIso)
      .lt("occurred_at", window.toIso)
      .order("occurred_at", { ascending: false }),
    db.from("categories").select("id,name,color,type").eq("is_system", true),
    db.from("categories").select("id,name,color").eq("user_id", userId),
    db.from("merchants").select("name,logo_url")
  ]);

  if (txError) {
    throw new Error(txError.message);
  }

  const transactions: LedgerTransaction[] = ((txRows ?? []) as Array<Record<string, unknown>>).map(
    (tx) => ({
      ...tx,
      amount_minor: Number(tx.amount_minor),
      occurred_at:
        tx.occurred_at instanceof Date
          ? (tx.occurred_at as Date).toISOString()
          : String(tx.occurred_at)
    })
  ) as unknown as LedgerTransaction[];

  // Merchant logo lookup. Case-insensitive match by name so transaction
  // merchant_name strings ("GoFood", "gofood") both resolve to the catalog
  // logo when one exists. System merchants ship logos (e.g. Netflix); user
  // merchants typically don't, which is fine — the UI falls back to an icon.
  const merchantLogoByName = new Map<string, string>();
  for (const merchant of (merchants ?? []) as Array<{ name: string; logo_url: string | null }>) {
    if (merchant.logo_url) {
      merchantLogoByName.set(merchant.name.trim().toLowerCase(), merchant.logo_url);
    }
  }

  // Category lookup: system + user categories combined.
  const catMap = new Map<string, { name: string; color: string }>(
    ((systemCategories ?? []) as Array<{ id: string; name: string; color: string }>)
      .concat((userCategories ?? []) as Array<{ id: string; name: string; color: string }>)
      .map((c) => [c.id, { name: c.name, color: c.color }])
  );

  // Aggregate totals + per-category.
  let income = 0;
  let expense = 0;
  let txCount = 0;
  const categoryTotals = new Map<string, { expense_minor: number; transaction_count: number }>();
  const merchantMap = new Map<string, { expense_minor: number; transaction_count: number }>();

  for (const tx of transactions) {
    if (tx.transfer_pair_id || tx.transaction_type === "transfer") continue;
    txCount += 1;
    const amount = Math.abs(tx.amount_minor);
    if (tx.transaction_type === "income") {
      income += amount;
    } else if (tx.transaction_type === "expense") {
      expense += amount;
      const catKey = tx.category_id ?? "__uncategorized__";
      const existing = categoryTotals.get(catKey) ?? { expense_minor: 0, transaction_count: 0 };
      existing.expense_minor += amount;
      existing.transaction_count += 1;
      categoryTotals.set(catKey, existing);

      const merchantKey = (tx.merchant_name ?? "Lainnya").trim() || "Lainnya";
      const m = merchantMap.get(merchantKey) ?? { expense_minor: 0, transaction_count: 0 };
      m.expense_minor += amount;
      m.transaction_count += 1;
      merchantMap.set(merchantKey, m);
    }
  }

  const by_category: CategoryBreakdownRow[] = [...categoryTotals.entries()]
    .sort((a, b) => b[1].expense_minor - a[1].expense_minor)
    .map(([key, val]) => {
      const isUncategorized = key === "__uncategorized__";
      const id = isUncategorized ? null : key;
      const meta = id ? (catMap.get(id) ?? null) : null;
      return {
        category_id: id,
        category_name: isUncategorized
          ? "Tanpa Kategori"
          : (meta?.name ?? "Tanpa Kategori"),
        category_color: meta?.color ?? "#94A3B8",
        expense_minor: val.expense_minor,
        expense_pct: expense > 0 ? Math.round((val.expense_minor / expense) * 100) : 0,
        transaction_count: val.transaction_count
      };
    });

  const top_merchants: MerchantRow[] = [...merchantMap.entries()]
    .sort((a, b) => b[1].expense_minor - a[1].expense_minor)
    .slice(0, 20)
    .map(([name, val]) => ({
      name,
      expense_minor: val.expense_minor,
      transaction_count: val.transaction_count,
      logo_url: merchantLogoByName.get(name.trim().toLowerCase()) ?? null
    }));

  // Previous-period totals (same length window immediately before).
  const windowMs = Date.parse(window.toIso) - Date.parse(window.fromIso);
  const prevFromIso = new Date(Date.parse(window.fromIso) - windowMs).toISOString();
  const prevToIso = window.fromIso;
  const { data: prevRows } = await db
    .from("transactions")
    .select("transaction_type,amount_minor,transfer_pair_id")
    .eq("user_id", userId)
    .gte("occurred_at", prevFromIso)
    .lt("occurred_at", prevToIso);

  let prevIncome = 0;
  let prevExpense = 0;
  for (const row of (prevRows ?? []) as Array<Record<string, unknown>>) {
    if (row.transfer_pair_id || row.transaction_type === "transfer") continue;
    const amt = Math.abs(Number(row.amount_minor));
    if (row.transaction_type === "income") prevIncome += amt;
    else if (row.transaction_type === "expense") prevExpense += amt;
  }

  // 6-month trend ending at window's month (for custom range, still anchored
  // at the start month of the range — caller sees 6 months of context).
  const [year, monthNum] = window.month.split("-").map(Number);
  const trendMonths: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(year, monthNum - 1 - i, 1));
    trendMonths.push(d.toISOString().slice(0, 7));
  }
  const earliestMonth = trendMonths[0];
  const { data: trendRows } = await db
    .from("transactions")
    .select("transaction_type,amount_minor,occurred_at,transfer_pair_id")
    .eq("user_id", userId)
    .gte("occurred_at", `${earliestMonth}-01T00:00:00.000Z`)
    .lt("occurred_at", nextMonthIso(window.month));

  const trendByMonth = new Map<string, { income: number; expense: number }>();
  for (const m of trendMonths) trendByMonth.set(m, { income: 0, expense: 0 });
  for (const row of (trendRows ?? []) as Array<Record<string, unknown>>) {
    const occurredAt =
      row.occurred_at instanceof Date
        ? (row.occurred_at as Date).toISOString()
        : String(row.occurred_at);
    const rowMonth = occurredAt.slice(0, 7);
    if (!trendByMonth.has(rowMonth)) continue;
    if (row.transfer_pair_id || row.transaction_type === "transfer") continue;
    const bucket = trendByMonth.get(rowMonth)!;
    const amt = Math.abs(Number(row.amount_minor));
    if (row.transaction_type === "income") bucket.income += amt;
    else if ((row.transaction_type as TransactionType) === "expense") bucket.expense += amt;
  }
  const trend: TrendRow[] = trendMonths.map((m) => {
    const b = trendByMonth.get(m) ?? { income: 0, expense: 0 };
    return { month: m, income_minor: b.income, expense_minor: b.expense };
  });

  const net = income - expense;
  const savings_rate_pct = income > 0 ? Math.round((net / income) * 100) : 0;

  return {
    window,
    totals: {
      income_minor: income,
      expense_minor: expense,
      net_minor: net,
      savings_rate_pct,
      transaction_count: txCount
    },
    previous_totals: {
      income_minor: prevIncome,
      expense_minor: prevExpense,
      net_minor: prevIncome - prevExpense
    },
    by_category,
    top_merchants,
    trend,
    transactions,
    generated_at: new Date().toISOString()
  };
}
