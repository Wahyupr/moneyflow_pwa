import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { buildDashboardViewModel, type DashboardBudget, type DashboardWallet } from "@/lib/dashboard";
import { normalizeExtractionDraft } from "@/lib/extraction";
import type { LedgerTransaction } from "@/lib/types";

export const runtime = "nodejs";

const BUDGET_PALETTE = ["#FF6B35", "#58A6FF", "#B891FF", "#2BB673", "#F5A623", "#EB5757"];

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const [
    { data: wallets, error: walletsError },
    { data: transactions, error: transactionsError },
    { data: drafts, error: draftsError },
    { data: profile },
    { data: budgetRows, error: budgetsError },
    { data: userCategories },
    { data: systemCategories }
  ] = await Promise.all([

    auth.supabase
      .from("wallets")
      .select("id,name,type,currency,color,icon,is_shared,opening_balance_minor")
      .eq("user_id", auth.user.id)
      .is("archived_at", null)
      .order("created_at"),
    auth.supabase
      .from("transactions")
      .select("id,user_id,wallet_id,category_id,merchant_name,payment_method,transaction_type,amount_minor,currency,occurred_at,transfer_pair_id")
      .eq("user_id", auth.user.id)
      .gte("occurred_at", `${month}-01T00:00:00.000Z`)
      .lt("occurred_at", nextMonthIso(month))
      .order("occurred_at", { ascending: false }),
    auth.supabase.from("transaction_drafts").select("id,extracted_json").eq("user_id", auth.user.id).eq("status", "pending_review").limit(5),
    auth.supabase.from("profiles").select("hide_nominal_default").eq("id", auth.user.id).maybeSingle(),
    auth.supabase
      .from("budgets")
      .select("id,category_id,amount_limit_minor,period")
      .eq("user_id", auth.user.id)
      .eq("is_active", true)
      .eq("period", "monthly"),
    auth.supabase.from("categories").select("id,name").eq("user_id", auth.user.id),
    auth.supabase.from("categories").select("id,name").eq("is_system", true)
  ]);


  if (walletsError || transactionsError || draftsError || budgetsError) {
    return NextResponse.json(
      {
        error:
          walletsError?.message ??
          transactionsError?.message ??
          draftsError?.message ??
          budgetsError?.message ??
          "Unable to load dashboard."
      },
      { status: 500 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walletRows: DashboardWallet[] = (wallets ?? []).map((wallet: any) => {

    const walletTransactions = ((transactions ?? []) as LedgerTransaction[]).filter((transaction) => transaction.wallet_id === wallet.id);
    const income = walletTransactions.filter((transaction) => transaction.transaction_type === "income").reduce((sum, transaction) => sum + transaction.amount_minor, 0);
    const expense = walletTransactions.filter((transaction) => transaction.transaction_type === "expense").reduce((sum, transaction) => sum + transaction.amount_minor, 0);

    return {
      id: wallet.id,
      name: wallet.name,
      type: wallet.type,
      balance_minor: (wallet.opening_balance_minor ?? 0) + income - expense,
      income_minor: income,
      expense_minor: expense,
      color: wallet.color,
      icon: wallet.icon,
      shared: wallet.is_shared
    };
  });

  const ledger = (transactions ?? []) as LedgerTransaction[];
  const categoryName = new Map<string, string>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [...(systemCategories ?? []), ...(userCategories ?? [])].map((category: any) => [category.id, category.name])
  );


  const expenseByCategory = new Map<string, number>();
  for (const transaction of ledger) {
    if (transaction.transaction_type !== "expense" || transaction.transfer_pair_id) {
      continue;
    }
    const key = transaction.category_id ?? "uncategorized";
    expenseByCategory.set(key, (expenseByCategory.get(key) ?? 0) + Math.abs(transaction.amount_minor));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const budgets: DashboardBudget[] = (budgetRows ?? []).map((budget: any, index: number) => ({
    id: budget.id,
    name: categoryName.get(budget.category_id) ?? "Budget",
    used_minor: expenseByCategory.get(budget.category_id) ?? 0,
    limit_minor: budget.amount_limit_minor,
    color: BUDGET_PALETTE[index % BUDGET_PALETTE.length]
  }));

  const dashboard = buildDashboardViewModel({
    month,
    wallets: walletRows,
    transactions: ledger,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    drafts: (drafts ?? []).map((item: any) => ({ id: item.id, draft: normalizeExtractionDraft(item.extracted_json) })),
    budgets,
    privacyEnabled: profile?.hide_nominal_default ?? false
  });

  return NextResponse.json({ dashboard });
}

function nextMonthIso(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 1)).toISOString();
}
