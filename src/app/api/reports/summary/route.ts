import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { summarizeMonthly } from "@/lib/reports";
import type { LedgerTransaction } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const { data, error } = await auth.supabase
    .from("transactions")
    .select("id,user_id,wallet_id,category_id,merchant_name,payment_method,transaction_type,amount_minor,currency,occurred_at,transfer_pair_id")
    .eq("user_id", auth.user.id)
    .gte("occurred_at", `${month}-01T00:00:00.000Z`)
    .lt("occurred_at", nextMonthIso(month));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ summary: summarizeMonthly((data ?? []) as LedgerTransaction[], month) });
}

function nextMonthIso(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 1)).toISOString();
}
