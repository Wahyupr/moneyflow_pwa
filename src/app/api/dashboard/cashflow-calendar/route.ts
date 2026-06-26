import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);

  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1)).toISOString();
  const monthEnd = new Date(Date.UTC(year, monthNumber, 1)).toISOString();

  // Get all wallet IDs the user has access to
  const walletsResult = await query<{ id: string }>(
    `select w.id from wallets w
     left join wallet_members wm on wm.wallet_id = w.id and wm.user_id = $1
     where (w.user_id = $1 or wm.user_id = $1) and w.archived_at is null`,
    [auth.user.id]
  );

  const walletIds = walletsResult.rows.map((w) => w.id);
  if (walletIds.length === 0) {
    return NextResponse.json({ calendar: [] });
  }

  const placeholders = walletIds.map((_, i) => `$${i + 3}`).join(", ");

  // Aggregate income and expense per day in the month
  const result = await query<{
    day: string;
    income_minor: string;
    expense_minor: string;
    tx_count: string;
  }>(
    `select
       date_trunc('day', occurred_at)::date::text as day,
       coalesce(sum(case when transaction_type = 'income' and transfer_pair_id is null then amount_minor else 0 end), 0) as income_minor,
       coalesce(sum(case when transaction_type = 'expense' and transfer_pair_id is null then amount_minor else 0 end), 0) as expense_minor,
       count(*) filter (where transfer_pair_id is null) as tx_count
     from transactions
     where occurred_at >= $1
       and occurred_at < $2
       and wallet_id in (${placeholders})
     group by date_trunc('day', occurred_at)::date
     order by day asc`,
    [monthStart, monthEnd, ...walletIds]
  );

  const calendar = result.rows.map((row) => ({
    day: row.day,
    income_minor: Number(row.income_minor),
    expense_minor: Number(row.expense_minor),
    tx_count: Number(row.tx_count)
  }));

  return NextResponse.json({ calendar });
}
