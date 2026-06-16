import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { toViewModel, type ReminderRow } from "@/lib/reminders";

export const runtime = "nodejs";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  amount_minor: z.number().int().positive(),
  wallet_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  merchant_id: z.string().uuid().nullable().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]).default("monthly"),
  next_run_at: z.string().datetime(),
  remind_days_before: z.number().int().min(0).max(30).default(5),
  day_of_month: z.number().int().min(1).max(31).nullable().optional(),
  day_of_week: z.number().int().min(0).max(6).nullable().optional()
});

/**
 * GET → list active reminders for the user, with computed `days_until` /
 * `status` / `paid_for_current_period` for the UI.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { data, error } = await auth.db
    .from("recurring_rules")
    .select(
      "id,user_id,wallet_id,category_id,merchant_id,name,amount_minor,currency,frequency,day_of_month,day_of_week,next_run_at,remind_days_before,is_active,last_paid_at"
    )
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .order("next_run_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    next_run_at: row.next_run_at instanceof Date ? row.next_run_at.toISOString() : String(row.next_run_at),
    last_paid_at:
      row.last_paid_at instanceof Date
        ? row.last_paid_at.toISOString()
        : row.last_paid_at == null
          ? null
          : String(row.last_paid_at)
  })) as ReminderRow[];

  return NextResponse.json({ reminders: rows.map((row) => toViewModel(row)) });
}

/** POST → create a new reminder. */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }
  const input = parsed.data;

  const { data, error } = await auth.db
    .from("recurring_rules")
    .insert({
      user_id: auth.user.id,
      wallet_id: input.wallet_id,
      category_id: input.category_id ?? null,
      merchant_id: input.merchant_id ?? null,
      name: input.name,
      amount_minor: input.amount_minor,
      currency: "IDR",
      frequency: input.frequency,
      day_of_month: input.day_of_month ?? null,
      day_of_week: input.day_of_week ?? null,
      next_run_at: input.next_run_at,
      remind_days_before: input.remind_days_before,
      is_active: true
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reminder: data }, { status: 201 });
}
