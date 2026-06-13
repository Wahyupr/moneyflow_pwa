import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { buildDashboardViewModel, type DashboardWallet } from "@/lib/dashboard";
import { normalizeExtractionDraft } from "@/lib/extraction";
import type { LedgerTransaction } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const [{ data: wallets, error: walletsError }, { data: transactions, error: transactionsError }, { data: drafts, error: draftsError }, { data: profile }] =
    await Promise.all([
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
      auth.supabase.from("profiles").select("hide_nominal_default").eq("id", auth.user.id).maybeSingle()
    ]);

  if (walletsError || transactionsError || draftsError) {
    return NextResponse.json(
      { error: walletsError?.message ?? transactionsError?.message ?? draftsError?.message ?? "Unable to load dashboard." },
      { status: 500 }
    );
  }

  const walletRows: DashboardWallet[] = (wallets ?? []).map((wallet) => {
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

  const dashboard = buildDashboardViewModel({
    month,
    wallets: walletRows,
    transactions: (transactions ?? []) as LedgerTransaction[],
    drafts: (drafts ?? []).map((item) => ({ id: item.id, draft: normalizeExtractionDraft(item.extracted_json) })),
    privacyEnabled: profile?.hide_nominal_default ?? false
  });

  return NextResponse.json({ dashboard });
}

function nextMonthIso(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 1)).toISOString();
}
