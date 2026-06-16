import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { getPool, query } from "@/lib/db/pool";
import { chatCompletion, getInsightConfig } from "@/lib/ai/insight-client";
import {
  buildDailyInsightPrompt,
  parseDailyInsightResponse,
  fallbackDailyInsight,
  type DailyInsightBudget,
  type DailyInsightContext,
  type DailyInsightSharingContribution,
  type DailyInsightWallet,
  type ParsedDailyInsight
} from "@/lib/ai/insight";
import { todayBoundsInTz, type DayBounds } from "@/lib/timezone";
import {
  FREE_PLAN_INSIGHT_LIMIT,
  canRegenerateInsight,
  decideInsightQuota,
  isFreeLimitReached,
  type InsightPlanTier
} from "@/lib/insight-quota";
import type { LedgerTransaction } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Jakarta";

type TriggerSource = "manual_button";
// Trigger source is always manual now — the lazy auto-trigger was removed
// when the free/premium quota model was introduced. Kept as a literal so the
// migration's CHECK constraint stays satisfied.
const TRIGGER_SOURCE: TriggerSource = "manual_button";

type StoredInsightRow = {
  id: string;
  insight_date: string;
  trigger_source: string;
  generated_at: string;
  window_from: string;
  window_to: string;
  payload: ParsedDailyInsight & { ai_error?: string | null };
  model: string;
};

type PlanTier = InsightPlanTier;

async function resolveUserPlan(userId: string): Promise<InsightPlanTier> {
  const result = await query<{ plan: InsightPlanTier }>(
    `select plan from subscription_entitlements where user_id = $1`,
    [userId]
  );
  return result.rows[0]?.plan ?? "free";
}

async function countCompletedInsights(userId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `select count(*)::text as count
     from daily_insights
     where user_id = $1 and model <> 'pending'`,
    [userId]
  );
  return Number(result.rows[0]?.count ?? 0);
}

async function fetchLatestCompletedInsight(userId: string): Promise<StoredInsightRow | null> {
  const result = await query<StoredInsightRow>(
    `select id, insight_date, trigger_source, generated_at, window_from, window_to, payload, model
     from daily_insights
     where user_id = $1 and model <> 'pending'
     order by insight_date desc, generated_at desc
     limit 1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

/**
 * GET /api/dashboard/insight
 *
 * Returns the user's most recent completed insight, or a "can generate" state
 * if they have none. Free users are limited to FREE_PLAN_INSIGHT_LIMIT lifetime
 * insights; premium users can regenerate any time via POST.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const plan = await resolveUserPlan(auth.user.id);
  const latest = await fetchLatestCompletedInsight(auth.user.id);
  const usageCount = latest ? await countCompletedInsights(auth.user.id) : 0;

  if (latest) {
    return NextResponse.json({
      exists: true,
      insight: latest.payload,
      generated_at: latest.generated_at,
      trigger_source: latest.trigger_source,
      window: { from: latest.window_from, to: latest.window_to },
      plan,
      usage_count: usageCount,
      free_limit: FREE_PLAN_INSIGHT_LIMIT,
      free_limit_reached: isFreeLimitReached({ plan, usageCount: usageCount }),
      can_regenerate: canRegenerateInsight(plan)
    });
  }

  return NextResponse.json({
    exists: false,
    can_generate: true,
    plan,
    usage_count: 0,
    free_limit: FREE_PLAN_INSIGHT_LIMIT,
    free_limit_reached: false,
    timezone: APP_TIMEZONE
  });
}

/**
 * POST /api/dashboard/insight
 *
 * Body: { "trigger": "manual_button" }
 *
 * Generates a new insight. Free users are blocked once they've reached
 * FREE_PLAN_INSIGHT_LIMIT lifetime insights. Premium users may regenerate
 * any time — the existing row for today (if any) is replaced atomically.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const body = (await request.json().catch(() => ({}))) as { trigger?: string };
  // Body trigger is accepted for backwards compatibility with the existing
  // client payload, but no longer affects server behavior — every write is
  // tagged as "manual_button".
  void body.trigger;

  const plan = await resolveUserPlan(auth.user.id);
  const bounds = todayBoundsInTz(APP_TIMEZONE);

  if (plan === "free") {
    const usageCount = await countCompletedInsights(auth.user.id);
    const decision = decideInsightQuota({ plan, usageCount });
    if (!decision.allowed) {
      return NextResponse.json(
        {
          exists: false,
          can_generate: false,
          reason: decision.reason,
          message:
            "Kuota insight gratis sudah habis. Upgrade ke Premium untuk insight tanpa batas.",
          plan,
          usage_count: decision.usageCount,
          free_limit: decision.freeLimit
        },
        { status: 403 }
      );
    }
  }

  // Premium regenerate path: clear any row for today (including stale
  // "pending" placeholders from a previous failed attempt) before re-claiming.
  // Wrapped in a transaction so concurrent requests can't race the cleanup.
  const client = await getPool().connect();
  try {
    await client.query("begin");
    if (plan === "premium") {
      await client.query(
        `delete from daily_insights where user_id = $1 and insight_date = $2`,
        [auth.user.id, bounds.date]
      );
    } else {
      // Free plan: clear any stale pending placeholder so the user isn't
      // blocked by a half-written row from a previous error.
      await client.query(
        `delete from daily_insights where user_id = $1 and insight_date = $2 and model = 'pending'`,
        [auth.user.id, bounds.date]
      );
    }

    const placeholder: ParsedDailyInsight = {
      headline: "Menyiapkan insight...",
      severity: "info",
      bullets: [],
      sharing_note: null,
      budget_alerts: []
    };

    const claim = await client.query<{ id: string }>(
      `insert into daily_insights (user_id, insight_date, trigger_source, window_from, window_to, payload, model)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7)
       on conflict (user_id, insight_date) do nothing
       returning id`,
      [
        auth.user.id,
        bounds.date,
        TRIGGER_SOURCE,
        bounds.startUtc,
        bounds.endUtc,
        JSON.stringify(placeholder),
        "pending"
      ]
    );

    if (claim.rows.length === 0) {
      await client.query("commit");
      const existing = await fetchInsight(auth.user.id, bounds.date);
      if (existing) {
        return NextResponse.json({
          exists: true,
          insight: existing.payload,
          generated_at: existing.generated_at,
          trigger_source: existing.trigger_source,
          reused: true,
          plan
        });
      }
      return NextResponse.json(
        { error: "Conflict resolved but no row was found." },
        { status: 500 }
      );
    }

    const insightId = claim.rows[0].id;
    await client.query("commit");

    const ctx = await buildContext(auth.user.id, auth.user.user_metadata.display_name, bounds);

    let parsed: ParsedDailyInsight;
    let model: string;
    let usage: unknown = null;
    let aiError: string | null = null;

    try {
      const messages = buildDailyInsightPrompt(ctx);
      const result = await chatCompletion(messages, { maxTokens: 900, temperature: 0.5, timeoutMs: 12_000 });
      parsed = parseDailyInsightResponse(result.content);
      model = result.model;
      usage = result.usage;
    } catch (error) {
      aiError = error instanceof Error ? error.message : "AI call failed.";
      parsed = fallbackDailyInsight(ctx);
      const cfg = getInsightConfig();
      model = cfg.model ? `${cfg.model} (fallback)` : "fallback";
    }

    const payloadToStore = { ...parsed, ai_error: aiError };

    await query(
      `update daily_insights
       set payload = $3::jsonb, model = $4, token_usage = $5::jsonb
       where id = $1 and user_id = $2`,
      [insightId, auth.user.id, JSON.stringify(payloadToStore), model, usage ? JSON.stringify(usage) : null]
    );

    return NextResponse.json({
      exists: true,
      insight: payloadToStore,
      generated_at: new Date().toISOString(),
      trigger_source: TRIGGER_SOURCE,
      plan,
      ai_error: aiError
    });
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // ignore rollback failure
    }
    throw error;
  } finally {
    client.release();
  }
}

async function fetchInsight(
  userId: string,
  dateStr: string
): Promise<StoredInsightRow | null> {
  const result = await query<StoredInsightRow>(
    `select id, insight_date, trigger_source, generated_at, window_from, window_to, payload, model
     from daily_insights
     where user_id = $1 and insight_date = $2
     limit 1`,
    [userId, dateStr]
  );
  return result.rows[0] ?? null;
}

async function buildContext(
  userId: string,
  displayName: string | null,
  bounds: DayBounds
): Promise<DailyInsightContext> {
  const walletsRes = await query<{
    id: string;
    name: string;
    is_shared: boolean;
    role: "owner" | "member" | "viewer" | null;
    opening_balance_minor: string;
  }>(
    `select w.id, w.name, w.is_shared, wm.role, w.opening_balance_minor
     from wallets w
     left join wallet_members wm on wm.wallet_id = w.id and wm.user_id = $1
     where (w.user_id = $1 or wm.user_id = $1) and w.archived_at is null`,
    [userId]
  );
  const walletIds = walletsRes.rows.map((w) => w.id);

  let recentTx: LedgerTransaction[] = [];
  let monthToDateTx: LedgerTransaction[] = [];

  if (walletIds.length > 0) {
    // IMPORTANT: every param in the array MUST be referenced in the SQL.
    // Unreferenced params cause "could not determine data type of parameter $N".
    const walletPlaceholders = walletIds.map((_, i) => `$${i + 1}`).join(",");

    const recentParams: unknown[] = [...walletIds, bounds.prevStartUtc, bounds.endUtc];
    const recentRes = await query<Record<string, unknown>>(
      `select t.id, t.user_id, t.wallet_id, t.category_id, t.merchant_name,
              t.payment_method, t.transaction_type, t.amount_minor, t.currency,
              t.occurred_at, t.transfer_pair_id
       from transactions t
       where t.wallet_id in (${walletPlaceholders})
         and t.occurred_at >= $${walletIds.length + 1}
         and t.occurred_at < $${walletIds.length + 2}
       order by t.occurred_at desc`,
      recentParams
    );
    recentTx = recentRes.rows.map(normalizeTransaction);

    const monthStartIso = monthStartInTz(bounds);
    const monthParams: unknown[] = [...walletIds, monthStartIso, bounds.endUtc];
    const monthRes = await query<Record<string, unknown>>(
      `select t.category_id, t.transaction_type, t.amount_minor, t.transfer_pair_id
       from transactions t
       where t.wallet_id in (${walletPlaceholders})
         and t.occurred_at >= $${walletIds.length + 1}
         and t.occurred_at < $${walletIds.length + 2}
         and t.transaction_type = 'expense'
         and t.transfer_pair_id is null`,
      monthParams
    );
    monthToDateTx = monthRes.rows.map((r) => ({
      ...r,
      amount_minor: Number(r.amount_minor),
      occurred_at: "",
      id: "",
      user_id: "",
      wallet_id: "",
      category_id: r.category_id as string | null,
      merchant_name: null,
      payment_method: null,
      currency: "IDR",
      transaction_type: "expense",
      transfer_pair_id: null
    })) as unknown as LedgerTransaction[];
  }

  const todayTx = recentTx.filter((t) => t.occurred_at >= bounds.startUtc && t.occurred_at < bounds.endUtc);

  let yesterday_income_minor = 0;
  let yesterday_expense_minor = 0;
  for (const t of recentTx) {
    if (t.occurred_at < bounds.startUtc && t.occurred_at >= bounds.prevStartUtc) {
      if (t.transaction_type === "income" && !t.transfer_pair_id) {
        yesterday_income_minor += Math.abs(t.amount_minor);
      } else if (t.transaction_type === "expense" && !t.transfer_pair_id) {
        yesterday_expense_minor += Math.abs(t.amount_minor);
      }
    }
  }

  const wallets: DailyInsightWallet[] = walletsRes.rows.map((w) => {
    const walletTx = todayTx.filter((t) => t.wallet_id === w.id);
    const today_income_minor = walletTx
      .filter((t) => t.transaction_type === "income")
      .reduce((s, t) => s + Math.abs(t.amount_minor), 0);
    const today_expense_minor = walletTx
      .filter((t) => t.transaction_type === "expense")
      .reduce((s, t) => s + Math.abs(t.amount_minor), 0);
    return {
      id: w.id,
      name: w.name,
      shared: w.is_shared,
      role: w.role ?? "owner",
      today_income_minor,
      today_expense_minor,
      balance_minor: Number(w.opening_balance_minor ?? 0) + today_income_minor - today_expense_minor
    };
  });

  const budgetRes = await query<{
    id: string;
    name: string;
    amount_limit_minor: string;
    category_id: string | null;
    period_end: string;
  }>(
    `select b.id, coalesce(c.name, 'Budget') as name, b.amount_limit_minor, b.category_id,
            (date_trunc('month', $2::timestamptz) + interval '1 month' - interval '1 day')::timestamptz as period_end
     from budgets b
     left join categories c on c.id = b.category_id
     where b.user_id = $1 and b.is_active = true and b.period = 'monthly'`,
    [userId, bounds.startUtc]
  );

  const expenseByCategoryId = new Map<string, number>();
  for (const t of monthToDateTx) {
    const key = t.category_id ?? "__uncategorized__";
    expenseByCategoryId.set(key, (expenseByCategoryId.get(key) ?? 0) + Math.abs(t.amount_minor));
  }

  const budgets: DailyInsightBudget[] = budgetRes.rows.map((b) => {
    const limit_minor = Number(b.amount_limit_minor);
    const used_minor = b.category_id
      ? (expenseByCategoryId.get(b.category_id) ?? 0)
      : 0;
    return {
      id: b.id,
      name: b.name,
      used_minor,
      limit_minor,
      period_end: b.period_end
    };
  });

  const sharedWalletIds = new Set(walletsRes.rows.filter((w) => w.is_shared).map((w) => w.id));
  let user_contributed_minor = 0;
  let others_contributed_minor = 0;
  for (const t of todayTx) {
    if (!sharedWalletIds.has(t.wallet_id)) continue;
    if (t.transaction_type !== "expense" || t.transfer_pair_id) continue;
    if (t.user_id === userId) {
      user_contributed_minor += Math.abs(t.amount_minor);
    } else {
      others_contributed_minor += Math.abs(t.amount_minor);
    }
  }

  const sharing: DailyInsightSharingContribution = {
    shared_wallets_count: sharedWalletIds.size,
    user_contributed_minor,
    others_contributed_minor
  };

  const profileRes = await query<{ hide_nominal_default: boolean | null }>(
    `select hide_nominal_default from profiles where id = $1`,
    [userId]
  );
  const privacyEnabled = profileRes.rows[0]?.hide_nominal_default ?? false;

  return {
    user: { id: userId, display_name: displayName },
    window: {
      from: bounds.startUtc,
      to: bounds.endUtc,
      label: "today"
    },
    privacyEnabled,
    wallets,
    today_transactions: todayTx,
    yesterday_totals: {
      income_minor: yesterday_income_minor,
      expense_minor: yesterday_expense_minor
    },
    budgets,
    sharing
  };
}

function normalizeTransaction(row: Record<string, unknown>): LedgerTransaction {
  return {
    ...(row as object),
    amount_minor: Number(row.amount_minor),
    occurred_at:
      row.occurred_at instanceof Date
        ? (row.occurred_at as Date).toISOString()
        : String(row.occurred_at)
  } as unknown as LedgerTransaction;
}

/**
 * Returns the UTC ISO of midnight at the start of the month containing the
 * current day, in the user's timezone.
 */
function monthStartInTz(bounds: DayBounds): string {
  const [y, m] = bounds.date.split("-").map(Number);
  const tz = APP_TIMEZONE;
  const reference = new Date(bounds.startUtc);
  const wallAsUtc = Date.UTC(
    Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric" }).format(reference)),
    Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "2-digit" }).format(reference)) - 1,
    Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, day: "2-digit" }).format(reference))
  );
  const offsetMs = wallAsUtc - reference.getTime();
  const monthStartWall = Date.UTC(y, m - 1, 1, 0, 0, 0);
  return new Date(monthStartWall - offsetMs).toISOString();
}
