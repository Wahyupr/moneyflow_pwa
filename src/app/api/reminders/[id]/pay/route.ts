import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { advanceNextRun, type ReminderRow } from "@/lib/reminders";

export const runtime = "nodejs";

/**
 * POST /api/reminders/[id]/pay
 *
 * Marks a recurring rule as paid for the current period:
 *   1) inserts a real expense transaction on the configured wallet/category,
 *   2) advances `next_run_at` to the next period,
 *   3) stamps `last_paid_at = now()` so the UI hides the "Bayar" button until
 *      the next period starts.
 *
 * The user has already confirmed in the UI that this will reduce their wallet
 * balance — we only do the side effects here.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) {
    return auth.response;
  }
  const { id } = await params;

  const { data: rule, error: ruleError } = await auth.supabase
    .from("recurring_rules")
    .select(
      "id,user_id,wallet_id,category_id,merchant_id,name,amount_minor,currency,frequency,next_run_at,last_paid_at,is_active"
    )
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (ruleError) {
    return NextResponse.json({ error: ruleError.message }, { status: 500 });
  }
  if (!rule) {
    return NextResponse.json({ error: "Pengingat tidak ditemukan." }, { status: 404 });
  }

  const ruleRow = rule as unknown as ReminderRow;
  const occurredAt = new Date().toISOString();
  const amount = Number(ruleRow.amount_minor);

  // 1) Create the expense transaction (the user's wallet balance is derived
  // from transactions, so this naturally reduces it).
  const { data: tx, error: txError } = await auth.supabase
    .from("transactions")
    .insert({
      user_id: auth.user.id,
      wallet_id: ruleRow.wallet_id,
      category_id: ruleRow.category_id ?? null,
      transaction_type: "expense",
      amount_minor: amount,
      currency: ruleRow.currency || "IDR",
      occurred_at: occurredAt,
      merchant_name: ruleRow.name,
      note: `Pembayaran rutin: ${ruleRow.name ?? "Reminder"}`,
      input_method: "reminder"
    })
    .select("*")
    .single();

  if (txError) {
    return NextResponse.json({ error: txError.message }, { status: 500 });
  }

  // 2) Advance the schedule. 3) Stamp last_paid_at.
  const next = advanceNextRun(ruleRow.next_run_at, ruleRow.frequency);
  await auth.supabase
    .from("recurring_rules")
    .update({ next_run_at: next, last_paid_at: occurredAt })
    .eq("id", ruleRow.id)
    .eq("user_id", auth.user.id);

  return NextResponse.json({ ok: true, transaction: tx, next_run_at: next });
}
