import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { canAccessHutangPiutang } from "@/lib/entitlements";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  creditor_name: z.string().min(1).max(120),
  category: z.string().min(1).max(80),
  total_amount_minor: z.number().int().positive(),
  initial_remaining_amount_minor: z.number().int().min(0).optional(),
  // If installment_months + interest_rate_per_month_bps are provided the API
  // computes monthly_installment_minor automatically (flat-rate formula).
  // The caller may also pass monthly_installment_minor directly (manual entry).
  installment_months: z.number().int().positive().nullable().optional(),
  interest_rate_per_month_bps: z.number().int().min(0).nullable().optional(),
  monthly_installment_minor: z.number().int().positive().nullable().optional(),
  next_due_date: z.string().datetime().nullable().optional(),
  target_paid_off_date: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional()
});

type DebtRow = {
  id: string;
  user_id: string;
  name: string;
  creditor_name: string;
  category: string;
  total_amount_minor: string;
  monthly_installment_minor: string | null;
  installment_months: string | null;
  interest_rate_per_month_bps: string | null;
  currency: string;
  next_due_date: string | null;
  target_paid_off_date: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  paid_amount_minor: string;
};

/**
 * Flat-rate installment calculation.
 * total_interest = principal × (bps/10000) × months
 * monthly = (principal + total_interest) / months
 */
function calcFlatInstallment(principalMinor: number, months: number, bpsPerMonth: number): number {
  const rateDecimal = bpsPerMonth / 10000;
  const totalInterest = principalMinor * rateDecimal * months;
  return Math.ceil((principalMinor + totalInterest) / months);
}

async function requirePremium(userId: string, recordCount = 0) {
  const result = await query<{ plan: string | null }>(
    "select plan from subscription_entitlements where user_id = $1 and status = 'active' and (current_period_end is null or current_period_end > now())",
    [userId]
  );
  const plan = (result.rows[0]?.plan ?? "free") as "free" | "premium" | "pro";
  return canAccessHutangPiutang({ plan, recordCount });
}

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const access = await requirePremium(auth.user.id);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 402 });

  const result = await query<DebtRow>(
    `select d.*, coalesce(p.paid, 0) as paid_amount_minor
       from debts d
       left join (
         select debt_id, sum(amount_minor) as paid
           from debt_payments
          group by debt_id
       ) p on p.debt_id = d.id
      where d.user_id = $1 and d.status = 'active'
      order by d.created_at desc`,
    [auth.user.id]
  );

  const rows = result.rows.map((row) => {
    const total = Number(row.total_amount_minor);
    const paid = Number(row.paid_amount_minor);
    const remaining = total - paid;
    const installmentMonths = row.installment_months != null ? Number(row.installment_months) : null;
    const bps = row.interest_rate_per_month_bps != null ? Number(row.interest_rate_per_month_bps) : null;
    const monthlyInstallment = row.monthly_installment_minor == null ? null : Number(row.monthly_installment_minor);

    // Derive interest totals from stored fields so the UI can show breakdowns.
    let totalInterestMinor: number | null = null;
    let totalWithInterestMinor: number | null = null;
    let interestRateTotalPct: number | null = null;
    if (installmentMonths != null && monthlyInstallment != null) {
      const totalPay = monthlyInstallment * installmentMonths;
      totalInterestMinor = Math.max(0, totalPay - total);
      totalWithInterestMinor = totalPay;
      interestRateTotalPct = total > 0 ? Number(((totalInterestMinor / total) * 100).toFixed(4)) : 0;
    }

    // Remaining with interest: proportional remaining principal + remaining interest
    let remainingWithInterestMinor: number | null = null;
    if (totalWithInterestMinor != null && total > 0) {
      const paidRatio = paid / total;
      const paidInterest = totalInterestMinor != null ? Math.round(totalInterestMinor * paidRatio) : 0;
      remainingWithInterestMinor = Math.max(0, (totalWithInterestMinor) - paid - paidInterest);
    }

    return {
      id: row.id,
      name: row.name,
      creditor_name: row.creditor_name,
      category: row.category,
      total_amount_minor: total,
      paid_amount_minor: paid,
      remaining_amount_minor: remaining,
      monthly_installment_minor: monthlyInstallment,
      installment_months: installmentMonths,
      interest_rate_per_month_bps: bps,
      total_interest_minor: totalInterestMinor,
      total_with_interest_minor: totalWithInterestMinor,
      interest_rate_total_pct: interestRateTotalPct,
      remaining_with_interest_minor: remainingWithInterestMinor,
      currency: row.currency,
      next_due_date: row.next_due_date,
      target_paid_off_date: row.target_paid_off_date,
      notes: row.notes,
      status: row.status,
      created_at: row.created_at
    };
  });

  const summary = rows.reduce(
    (acc, row) => {
      acc.total_principal_minor += row.total_amount_minor;
      acc.total_paid_minor += row.paid_amount_minor;
      acc.total_remaining_minor += row.remaining_amount_minor;
      // Remaining including interest: use the interest-aware value when available,
      // otherwise fall back to the principal-only remaining for debts without a tenor.
      acc.total_remaining_with_interest_minor += row.remaining_with_interest_minor ?? row.remaining_amount_minor;
      acc.total_monthly_installment_minor += row.monthly_installment_minor ?? 0;
      return acc;
    },
    {
      total_principal_minor: 0,
      total_paid_minor: 0,
      total_remaining_minor: 0,
      total_remaining_with_interest_minor: 0,
      total_monthly_installment_minor: 0
    }
  );

  return NextResponse.json({ debts: rows, summary });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const access = await requirePremium(auth.user.id);
  if (!access.ok) return NextResponse.json({ error: access.reason }, { status: 402 });

  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data hutang tidak valid." }, { status: 400 });
  }
  const input = parsed.data;

  if (input.initial_remaining_amount_minor !== undefined && input.initial_remaining_amount_minor > input.total_amount_minor) {
    return NextResponse.json({ error: "Sisa awal tidak boleh lebih besar dari total pinjaman." }, { status: 400 });
  }

  // Resolve monthly installment: prefer explicit value, otherwise compute from tenor + rate.
  let resolvedMonthlyMinor: number | null = input.monthly_installment_minor ?? null;
  if (resolvedMonthlyMinor == null && input.installment_months != null) {
    const bps = input.interest_rate_per_month_bps ?? 0;
    resolvedMonthlyMinor = calcFlatInstallment(input.total_amount_minor, input.installment_months, bps);
  }

  const insertResult = await query<{ id: string }>(
    `insert into debts (user_id, name, creditor_name, category, total_amount_minor,
                        monthly_installment_minor, installment_months, interest_rate_per_month_bps,
                        next_due_date, target_paid_off_date, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning id`,
    [
      auth.user.id,
      input.name.trim(),
      input.creditor_name.trim(),
      input.category.trim(),
      input.total_amount_minor,
      resolvedMonthlyMinor,
      input.installment_months ?? null,
      input.interest_rate_per_month_bps ?? null,
      input.next_due_date ?? null,
      input.target_paid_off_date ?? null,
      input.notes?.trim() ?? null
    ]
  );

  const debtId = insertResult.rows[0].id;

  // If user enters a debt that already has prior payments, record them as a
  // baseline payment so the remaining balance is correct from day one.
  if (input.initial_remaining_amount_minor !== undefined && input.initial_remaining_amount_minor < input.total_amount_minor) {
    const initialPaid = input.total_amount_minor - input.initial_remaining_amount_minor;
    await query(
      `insert into debt_payments (debt_id, amount_minor, paid_at, notes)
       values ($1, $2, now(), 'Saldo awal terbayar')`,
      [debtId, initialPaid]
    );
  }

  return NextResponse.json({ id: debtId }, { status: 201 });
}
