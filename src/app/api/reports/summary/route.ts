import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { summarizeMonthly } from "@/lib/reports";
import type { LedgerTransaction } from "@/lib/types";

export const runtime = "nodejs";

function nextMonthIso(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m, 1)).toISOString();
}

/**
 * GET /api/reports/summary
 *
 * Query params (choose one style):
 *   month=YYYY-MM          → single calendar month (default: current month)
 *   from=YYYY-MM-DD&to=YYYY-MM-DD → arbitrary date range
 *
 * Returns totals, category breakdown, top merchants, 6-month trend.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);

  // Resolve the date window.
  let fromIso: string;
  let toIso: string;
  let month: string;

  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (fromParam && toParam) {
    fromIso = `${fromParam}T00:00:00.000Z`;
    // Make "to" inclusive by using start of the NEXT day with .lt
    const toDate = new Date(`${toParam}T00:00:00.000Z`);
    toDate.setUTCDate(toDate.getUTCDate() + 1);
    toIso = toDate.toISOString();
    // Use the start month as the "month" label for summarizeMonthly (it filters by startsWith).
    month = fromParam.slice(0, 7);

  } else {
    month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    fromIso = `${month}-01T00:00:00.000Z`;
    toIso = nextMonthIso(month);
  }

  // Transactions for the requested period.
  const [{ data: txRows, error: txError }, { data: systemCategories }, { data: allMerchants }] = await Promise.all([
    auth.supabase
      .from("transactions")
      .select("id,user_id,wallet_id,category_id,merchant_name,payment_method,transaction_type,amount_minor,currency,occurred_at,transfer_pair_id")
      .eq("user_id", auth.user.id)
      .gte("occurred_at", fromIso)
      .lt("occurred_at", toIso)
      .order("occurred_at", { ascending: false }),
    auth.supabase
      .from("categories")
      .select("id,name,color,type")
      .eq("is_system", true),
    auth.supabase
      .from("merchants")
      .select("name,logo_url")
  ]);

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  // Normalize dates + coerce bigint strings to numbers.
  const transactions = ((txRows ?? []) as Array<Record<string, unknown>>).map((tx) => ({
    ...tx,
    amount_minor: Number(tx.amount_minor),
    occurred_at:
      tx.occurred_at instanceof Date
        ? tx.occurred_at.toISOString()
        : String(tx.occurred_at)
  })) as unknown as LedgerTransaction[];

  // For a custom multi-month range, summarizeMonthly only counts transactions in
  // the start month (it uses .startsWith(month)). Compute totals directly from
  // the already-filtered transactions array so all months in the range count.
  const isCustomRange = Boolean(fromParam && toParam);
  const summary = isCustomRange
    ? (() => {
        let income = 0, expense = 0;
        const categoryTotals = new Map<string, number>();
        for (const tx of transactions) {
          if (tx.transfer_pair_id || tx.transaction_type === "transfer") continue;
          if (tx.transaction_type === "income") income += Math.abs(tx.amount_minor);
          if (tx.transaction_type === "expense") {
            const amt = Math.abs(tx.amount_minor);
            expense += amt;
            const key = tx.category_id ?? "uncategorized";
            categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + amt);
          }
        }
        return {
          month,
          totals: { income_minor: income, expense_minor: expense, net_minor: income - expense },
          by_category: [...categoryTotals.entries()].map(([id, amt]) => ({
            category_id: id === "uncategorized" ? null : id,
            expense_minor: amt
          }))
        };
      })()
    : summarizeMonthly(transactions, month);


  // Enrich category breakdown with names and colors.
  const catMap = new Map<string, { name: string; color: string }>(
    ((systemCategories ?? []) as Array<{ id: string; name: string; color: string }>).map((c) => [c.id, { name: c.name, color: c.color }])
  );

  const by_category = summary.by_category
    .sort((a, b) => b.expense_minor - a.expense_minor)
    .map((row) => ({
      category_id: row.category_id,
      category_name: row.category_id ? (catMap.get(row.category_id)?.name ?? "Lainnya") : "Tanpa kategori",
      category_color: row.category_id ? (catMap.get(row.category_id)?.color ?? "#94a3b8") : "#94a3b8",
      expense_minor: row.expense_minor
    }));

  // Top 5 merchants by expense.
  const merchantMap = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.transaction_type !== "expense" || tx.transfer_pair_id) {
      continue;
    }
    const key = tx.merchant_name ?? "Lainnya";
    merchantMap.set(key, (merchantMap.get(key) ?? 0) + Math.abs(tx.amount_minor));
  }
  // Build a logo lookup from the merchant directory (system + own).
  const merchantLogoMap = new Map<string, string | null>(
    ((allMerchants ?? []) as Array<{ name: string; logo_url: string | null }>).map((m) => [
      m.name.trim().toLowerCase(),
      m.logo_url ?? null
    ])
  );

  const top_merchants = [...merchantMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, expense_minor]) => ({
      name,
      expense_minor,
      logo_url: merchantLogoMap.get(name.trim().toLowerCase()) ?? null
    }));

  // Last 6 months trend.
  const [year, monthNum] = month.split("-").map(Number);
  const trendMonths: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(year, monthNum - 1 - i, 1));
    trendMonths.push(d.toISOString().slice(0, 7));
  }

  const earliestMonth = trendMonths[0];
  const { data: trendRows } = await auth.supabase
    .from("transactions")
    .select("transaction_type,amount_minor,occurred_at,transfer_pair_id")
    .eq("user_id", auth.user.id)
    .gte("occurred_at", `${earliestMonth}-01T00:00:00.000Z`)
    .lt("occurred_at", nextMonthIso(month));

  const trendByMonth = new Map<string, { income: number; expense: number }>();
  for (const m of trendMonths) {
    trendByMonth.set(m, { income: 0, expense: 0 });
  }
  for (const row of (trendRows ?? []) as Array<Record<string, unknown>>) {
    const occurredAt = row.occurred_at instanceof Date ? row.occurred_at.toISOString() : String(row.occurred_at);
    const rowMonth = occurredAt.slice(0, 7);
    if (!trendByMonth.has(rowMonth)) {
      continue;
    }
    if (row.transfer_pair_id || row.transaction_type === "transfer") {
      continue;
    }
    const bucket = trendByMonth.get(rowMonth)!;
    const amount = Math.abs(Number(row.amount_minor));
    if (row.transaction_type === "income") {
      bucket.income += amount;
    } else if (row.transaction_type === "expense") {
      bucket.expense += amount;
    }
  }

  const trend = trendMonths.map((m) => {
    const bucket = trendByMonth.get(m) ?? { income: 0, expense: 0 };
    return { month: m, income_minor: bucket.income, expense_minor: bucket.expense };
  });

  return NextResponse.json({
    month,
    totals: summary.totals,
    by_category,
    top_merchants,
    trend
  });
}
