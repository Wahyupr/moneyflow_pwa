import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { canCreateWallet } from "@/lib/entitlements";
import { validateWalletInput } from "@/lib/wallets";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const [{ data, error }, { data: transactions, error: transactionsError }] = await Promise.all([
    auth.db
      .from("wallets")
      .select("*")
      .eq("user_id", auth.user.id)
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
    auth.db
      .from("transactions")
      .select("wallet_id,transaction_type,amount_minor")
      .eq("user_id", auth.user.id)
  ]);

  if (error || transactionsError) {
    return NextResponse.json({ error: (error ?? transactionsError)?.message }, { status: 500 });
  }

  // Derive each wallet's live balance from its opening balance plus the net of
  // its income/expense transactions (transfers are stored as income/expense
  // legs, so they net out correctly across the two wallets).
  const incomeByWallet = new Map<string, number>();
  const expenseByWallet = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const transaction of (transactions ?? []) as any[]) {
    const target = transaction.transaction_type === "income" ? incomeByWallet : expenseByWallet;
    target.set(transaction.wallet_id, (target.get(transaction.wallet_id) ?? 0) + Number(transaction.amount_minor));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wallets = ((data ?? []) as any[]).map((wallet) => {
    const income = incomeByWallet.get(wallet.id) ?? 0;
    const expense = expenseByWallet.get(wallet.id) ?? 0;

    return {
      ...wallet,
      income_minor: income,
      expense_minor: expense,
      balance_minor: Number(wallet.opening_balance_minor ?? 0) + income - expense
    };
  });

  return NextResponse.json({ wallets });
}


export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const parsed = validateWalletInput(await request.json().catch(() => ({})));

  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid wallet payload.", errors: parsed.errors }, { status: 400 });
  }

  const { count } = await auth.db
    .from("wallets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id);
  const { data: entitlement } = await auth.db
    .from("subscription_entitlements")
    .select("plan")
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .maybeSingle();
  const limit = canCreateWallet({ plan: entitlement?.plan === "premium" ? "premium" : "free", walletCount: count ?? 0 });

  if (!limit.ok) {
    return NextResponse.json({ error: limit.reason }, { status: 402 });
  }

  const { data, error } = await auth.db
    .from("wallets")
    .insert({ ...parsed.data, user_id: auth.user.id })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ wallet: data }, { status: 201 });
}
