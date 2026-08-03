import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";
import { PLAN_LIMITS } from "@/lib/entitlements";
import type { PlanTier } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const userId = auth.user.id;

  // Fetch plan + all usage counts in parallel
  const [
    planResult,
    walletsResult,
    budgetsResult,
    remindersResult,
    debtsResult,
    receivablesResult,
    merchantsResult,
    categoriesResult,
    voiceResult,
    scanResult,
    exportResult,
    insightsResult,
  ] = await Promise.all([
    // Plan
    query<{ plan: string | null }>(
      "select plan from subscription_entitlements where user_id = $1 and status = 'active' and (current_period_end is null or current_period_end > now())",
      [userId]
    ),
    // Wallets (owned + member)
    query<{ count: string }>(
      `select count(*)::int as count from wallets
       where user_id = $1 and archived_at is null`,
      [userId]
    ),
    // Active budgets
    query<{ count: string }>(
      `select count(*)::int as count from budgets
       where user_id = $1 and is_active = true`,
      [userId]
    ),
    // Reminders (uses recurring_rules table; filtered by is_active)
    query<{ count: string }>(
      `select count(*)::int as count from recurring_rules
       where user_id = $1 and is_active = true`,
      [userId]
    ),
    // Active debts
    query<{ count: string }>(
      `select count(*)::int as count from debts
       where user_id = $1 and status = 'active'`,
      [userId]
    ),
    // Active receivables
    query<{ count: string }>(
      `select count(*)::int as count from receivables
       where user_id = $1 and status = 'active'`,
      [userId]
    ),
    // Custom merchants (created by this user)
    query<{ count: string }>(
      `select count(*)::int as count from merchants
       where created_by = $1`,
      [userId]
    ),
    // Custom categories created by this user (non-system rows owned by this user)
    query<{ count: string }>(
      `select count(*)::int as count from categories
       where user_id = $1 and is_system = false`,
      [userId]
    ),
    // Voice input today
    query<{ count: string }>(
      `select count(*)::int as count from transactions
       where user_id = $1 and input_method = 'voice'
         and occurred_at >= date_trunc('day', now() at time zone 'Asia/Jakarta')`,
      [userId]
    ),
    // Scan struk this month
    query<{ count: string }>(
      `select count(*)::int as count from transactions
       where user_id = $1 and input_method = 'receipt_scan'
         and occurred_at >= date_trunc('month', now() at time zone 'Asia/Jakarta')`,
      [userId]
    ),
    // Exports this month — from insight_quota or a separate table if available
    // Approximation: count export_logs or default to 0 if table doesn't exist
    query<{ count: string }>(
      `select count(*)::int as count from export_logs
       where user_id = $1
         and created_at >= date_trunc('month', now() at time zone 'Asia/Jakarta')`,
      [userId]
    ).catch(() => ({ rows: [{ count: "0" }] })),
    // AI Insights this month
    query<{ count: string }>(
      `select coalesce(used_count, 0)::int as count from insight_quotas
       where user_id = $1
         and period_start = date_trunc('month', now() at time zone 'Asia/Jakarta')::date`,
      [userId]
    ).catch(() => ({ rows: [{ count: "0" }] })),
  ]);

  const plan = ((planResult.rows[0]?.plan ?? "free") as PlanTier);
  const limits = PLAN_LIMITS[plan];

  const debtCount = Number(debtsResult.rows[0]?.count ?? 0) + Number(receivablesResult.rows[0]?.count ?? 0);

  const usage = {
    plan,
    items: [
      {
        key: "wallets",
        label: "Dompet",
        used: Number(walletsResult.rows[0]?.count ?? 0),
        max: limits.wallets,
      },
      {
        key: "activeBudgets",
        label: "Budget aktif",
        used: Number(budgetsResult.rows[0]?.count ?? 0),
        max: limits.activeBudgets,
      },
      {
        key: "reminders",
        label: "Pengingat tagihan",
        used: Number(remindersResult.rows[0]?.count ?? 0),
        max: limits.reminders,
      },
      {
        key: "debtRecords",
        label: "Hutang & Piutang",
        used: debtCount,
        max: limits.debtRecords,
      },
      {
        key: "customMerchants",
        label: "Merchant kustom",
        used: Number(merchantsResult.rows[0]?.count ?? 0),
        max: limits.customMerchants,
      },
      {
        key: "customCategories",
        label: "Kategori kustom",
        used: Number(categoriesResult.rows[0]?.count ?? 0),
        max: limits.customCategories,
      },
      {
        key: "voicePerDay",
        label: "Input suara hari ini",
        used: Number(voiceResult.rows[0]?.count ?? 0),
        max: limits.voicePerDay,
      },
      {
        key: "scanPerMonth",
        label: "Scan struk bulan ini",
        used: Number(scanResult.rows[0]?.count ?? 0),
        // Free = 7/month displayed as monthly, others = daily limit
        max: plan === "free" ? 7 : limits.scanPerDay,
      },
      {
        key: "exportPerMonth",
        label: "Ekspor laporan bulan ini",
        used: Number(exportResult.rows[0]?.count ?? 0),
        max: limits.exportPerMonth,
      },
      {
        key: "aiInsightsPerMonth",
        label: "AI Insights bulan ini",
        used: Number(insightsResult.rows[0]?.count ?? 0),
        max: limits.aiInsightsPerMonth,
      },
    ] as Array<{ key: string; label: string; used: number; max: number | null }>,
  };

  return NextResponse.json(usage);
}
