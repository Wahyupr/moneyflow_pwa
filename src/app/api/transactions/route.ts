import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const TransactionSchema = z.object({
  wallet_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  transaction_type: z.enum(["expense", "income", "transfer"]),
  amount_minor: z.number().int().positive(),
  currency: z.string().length(3).default("IDR"),
  occurred_at: z.string().datetime(),
  merchant_name: z.string().max(120).nullable().optional(),
  payment_method: z.string().max(80).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  input_method: z.enum(["manual", "receipt_scan", "evidence_upload", "voice", "auto_recurring"]).default("manual")
});

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const walletFilter = searchParams.get("wallet");
  const typeFilter = searchParams.get("type");

  // Build accessible wallet IDs: owned + shared via wallet_members.
  // We use a subquery so it works even when there are 0 shared wallets.
  const params: unknown[] = [auth.user.id];
  let walletSubquery = `(
    select id from wallets where user_id = $1 and archived_at is null
    union
    select wallet_id from wallet_members where user_id = $1
  )`;

  // Optional single-wallet filter — still scoped to accessible wallets so a
  // user can't query a wallet they don't have access to.
  if (walletFilter) {
    params.push(walletFilter);
    walletSubquery = `(
      select id from wallets where user_id = $1 and archived_at is null and id = $${params.length}
      union
      select wallet_id from wallet_members where user_id = $1 and wallet_id = $${params.length}
    )`;
  }

  let whereClauses = `t.wallet_id in ${walletSubquery}`;

  if (typeFilter) {
    params.push(typeFilter);
    whereClauses += ` and t.transaction_type = $${params.length}`;
  }

  const sql = `
    select
      t.id, t.user_id, t.wallet_id, t.category_id, t.transaction_type,
      t.amount_minor, t.currency, t.occurred_at, t.merchant_name,
      t.payment_method, t.note, t.input_method, t.transfer_pair_id,
      t.recurring_id, t.mood, t.raw_receipt_text,
      coalesce(u.display_name, u.email) as created_by_name,
      w.name as wallet_name
    from transactions t
    join users u on u.id = t.user_id
    join wallets w on w.id = t.wallet_id
    where ${whereClauses}
    order by t.occurred_at desc
    limit 100
  `;

  const result = await query<Record<string, unknown>>(sql, params);

  if (!result) {
    return NextResponse.json({ error: "Query failed." }, { status: 500 });
  }

  // Resolve merchant logos by name from the global merchant directory.
  const { data: merchants } = await auth.db.from("merchants").select("name,logo_url").eq("is_system", true);
  const merchantLogoByName = new Map<string, string>();
  for (const merchant of (merchants ?? []) as Array<{ name: string; logo_url: string | null }>) {
    if (merchant.logo_url) {
      merchantLogoByName.set(merchant.name.trim().toLowerCase(), merchant.logo_url);
    }
  }

  const transactions = result.rows.map((transaction) => ({
    ...transaction,
    merchant_logo_url:
      typeof transaction.merchant_name === "string"
        ? merchantLogoByName.get(transaction.merchant_name.trim().toLowerCase()) ?? null
        : null
  }));

  return NextResponse.json({ transactions }, {
    headers: { "Cache-Control": "no-store" }
  });
}


export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const parsed = TransactionSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transaction payload." }, { status: 400 });
  }

  // Verify the caller has access to the wallet (owns it OR is a member).
  const walletCheck = await query(
    `select id from wallets w
     where w.id = $1 and w.archived_at is null
       and (
         w.user_id = $2
         or exists (
           select 1 from wallet_members wm where wm.wallet_id = w.id and wm.user_id = $2
         )
       )`,
    [parsed.data.wallet_id, auth.user.id]
  );

  if (walletCheck.rows.length === 0) {
    return NextResponse.json({ error: "Wallet not found or access denied." }, { status: 403 });
  }

  const { data, error } = await auth.db
    .from("transactions")
    .insert({ ...parsed.data, user_id: auth.user.id })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transaction: data }, { status: 201 });
}
