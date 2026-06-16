import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { canCreateWallet } from "@/lib/entitlements";
import { validateWalletInput } from "@/lib/wallets";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  // Fetch wallets owned by the user OR shared with them via wallet_members.
  // member_role is null for owned wallets (owner is not in wallet_members).
  const walletsResult = await query<{
    id: string;
    user_id: string;
    name: string;
    type: string;
    currency: string;
    color: string;
    icon: string;
    is_shared: boolean;
    is_hidden: boolean;
    opening_balance_minor: string;
    institution_name: string | null;
    phone_number: string | null;
    account_number: string | null;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
    member_role: string | null;
  }>(
    `select w.*, wm.role as member_role
     from wallets w
     left join wallet_members wm on wm.wallet_id = w.id and wm.user_id = $1
     where (w.user_id = $1 or wm.user_id = $1)
       and w.archived_at is null
     order by w.created_at asc`,
    [auth.user.id]
  );

  const walletRows = walletsResult.rows;
  const walletIds = walletRows.map((w) => w.id);

  if (walletIds.length === 0) {
    return NextResponse.json({ wallets: [] });
  }

  // Fetch transactions for all visible wallets.
  // For shared wallets, transactions from ALL members should contribute to the balance.
  const placeholders = walletIds.map((_, i) => `$${i + 1}`).join(", ");
  const transactionsResult = await query<{
    wallet_id: string;
    transaction_type: string;
    amount_minor: string;
  }>(
    `select wallet_id, transaction_type, amount_minor
     from transactions
     where wallet_id in (${placeholders})`,
    walletIds
  );

  const incomeByWallet = new Map<string, number>();
  const expenseByWallet = new Map<string, number>();

  for (const transaction of transactionsResult.rows) {
    const target = transaction.transaction_type === "income" ? incomeByWallet : expenseByWallet;
    target.set(transaction.wallet_id, (target.get(transaction.wallet_id) ?? 0) + Number(transaction.amount_minor));
  }

  const wallets = walletRows.map((wallet) => {
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
