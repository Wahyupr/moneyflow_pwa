import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { buildDashboardViewModel, type DashboardBudget, type DashboardWallet } from "@/lib/dashboard";
import { normalizeExtractionDraft } from "@/lib/extraction";
import type { LedgerTransaction } from "@/lib/types";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const BUDGET_PALETTE = ["#FF6B35", "#58A6FF", "#B891FF", "#2BB673", "#F5A623", "#EB5757"];

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const monthStart = `${month}-01T00:00:00.000Z`;
  const monthEnd = nextMonthIso(month);

  // Fetch all wallets the user has access to: owned + shared via wallet_members.
  const walletsResult = await query<{
    id: string;
    name: string;
    type: string;
    currency: string;
    color: string;
    icon: string;
    is_shared: boolean;
    opening_balance_minor: string;
    member_role: string | null;
  }>(
    `select w.id, w.name, w.type, w.currency, w.color, w.icon,
            w.is_shared, w.opening_balance_minor, wm.role as member_role
     from wallets w
     left join wallet_members wm on wm.wallet_id = w.id and wm.user_id = $1
     where (w.user_id = $1 or wm.user_id = $1)
       and w.archived_at is null
     order by w.created_at asc`,
    [auth.user.id]
  );

  const walletRows = walletsResult.rows;
  const walletIds = walletRows.map((w) => w.id);

  // Resolve merchant logos once, used for both all-time and monthly transactions.
  const { data: merchants } = await auth.db.from("merchants").select("name,logo_url").eq("is_system", true);
  const merchantLogoByName = new Map<string, string>();
  for (const merchant of (merchants ?? []) as Array<{ name: string; logo_url: string | null }>) {
    if (merchant.logo_url) {
      merchantLogoByName.set(merchant.name.trim().toLowerCase(), merchant.logo_url);
    }
  }

  function normalizeTx(transaction: Record<string, unknown>): LedgerTransaction {
    return {
      ...transaction,
      amount_minor: Number(transaction.amount_minor),
      occurred_at:
        transaction.occurred_at instanceof Date
          ? (transaction.occurred_at as Date).toISOString()
          : String(transaction.occurred_at),
      merchant_logo_url:
        typeof transaction.merchant_name === "string"
          ? merchantLogoByName.get(transaction.merchant_name.trim().toLowerCase()) ?? null
          : null
    } as unknown as LedgerTransaction;
  }

  // Fetch all-time transactions for live balance calculation.
  // Fetch monthly transactions for income/expense summaries and recent list.
  let allTimeTx: LedgerTransaction[] = [];
  let ledger: LedgerTransaction[] = [];

  if (walletIds.length > 0) {
    const placeholders = walletIds.map((_, i) => `$${i + 1}`).join(", ");

    const [allTimeResult, monthlyResult] = await Promise.all([
      query<Record<string, unknown>>(
        `select t.id, t.user_id, t.wallet_id, t.category_id, t.merchant_name,
                t.payment_method, t.transaction_type, t.amount_minor, t.currency,
                t.occurred_at, t.transfer_pair_id,
                coalesce(u.display_name, u.email) as created_by_name
         from transactions t
         join users u on u.id = t.user_id
         where t.wallet_id in (${placeholders})`,
        walletIds
      ),
      query<Record<string, unknown>>(
        `select t.id, t.user_id, t.wallet_id, t.category_id, t.merchant_name,
                t.payment_method, t.transaction_type, t.amount_minor, t.currency,
                t.occurred_at, t.transfer_pair_id,
                coalesce(u.display_name, u.email) as created_by_name
         from transactions t
         join users u on u.id = t.user_id
         where t.wallet_id in (${placeholders})
           and t.occurred_at >= $${walletIds.length + 1}
           and t.occurred_at < $${walletIds.length + 2}
         order by t.occurred_at desc`,
        [...walletIds, monthStart, monthEnd]
      )
    ]);

    allTimeTx = allTimeResult.rows.map(normalizeTx);
    ledger = monthlyResult.rows.map(normalizeTx);
  }

  // Build wallet view models with LIVE balance from ALL-TIME transactions.
  // income_minor / expense_minor on the card show the monthly figure for context.
  const dashboardWallets: DashboardWallet[] = walletRows.map((wallet) => {
    const allTx = allTimeTx.filter((t) => t.wallet_id === wallet.id);
    const monthTx = ledger.filter((t) => t.wallet_id === wallet.id);

    const totalIncome = allTx.filter((t) => t.transaction_type === "income").reduce((sum, t) => sum + Number(t.amount_minor), 0);
    const totalExpense = allTx.filter((t) => t.transaction_type === "expense").reduce((sum, t) => sum + Number(t.amount_minor), 0);
    const monthIncome = monthTx.filter((t) => t.transaction_type === "income").reduce((sum, t) => sum + Number(t.amount_minor), 0);
    const monthExpense = monthTx.filter((t) => t.transaction_type === "expense").reduce((sum, t) => sum + Number(t.amount_minor), 0);

    return {
      id: wallet.id,
      name: wallet.name,
      type: wallet.type,
      balance_minor: Number(wallet.opening_balance_minor ?? 0) + totalIncome - totalExpense,
      income_minor: monthIncome,
      expense_minor: monthExpense,
      color: wallet.color,
      icon: wallet.icon,
      shared: wallet.is_shared
    };
  });

  // Remaining parallel queries that are still user-scoped (personal data).
  const [
    { data: drafts },
    { data: profile },
    { data: budgetRows },
    { data: userCategories },
    { data: systemCategories }
  ] = await Promise.all([
    auth.db.from("transaction_drafts").select("id,extracted_json").eq("user_id", auth.user.id).eq("status", "pending_review").limit(5),
    auth.db.from("profiles").select("hide_nominal_default").eq("id", auth.user.id).maybeSingle(),
    auth.db.from("budgets").select("id,category_id,amount_limit_minor,period").eq("user_id", auth.user.id).eq("is_active", true).eq("period", "monthly"),
    auth.db.from("categories").select("id,name").eq("user_id", auth.user.id),
    auth.db.from("categories").select("id,name").eq("is_system", true)
  ]);

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
    wallets: dashboardWallets,
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
