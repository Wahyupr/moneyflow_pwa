/**
 * AI credit system.
 *
 * Each user has a single credit wallet that refills every 30 days (rolling,
 * anchored on `subscription_entitlements.ai_credits_cycle_start`). Every AI
 * action deducts a configurable number of credits. Admins tune both the
 * per-action cost (`ai_credit_costs`) and the per-plan allowance
 * (`plan_limits.ai_credits_per_cycle`, null = unlimited).
 *
 * The pure helpers below hold the decision logic so they can be unit-tested
 * without a database; `consumeAiCredits` / `getCreditBalance` wrap them with
 * the actual queries.
 */

import { query } from "@/lib/db/pool";
import type { PlanTier } from "@/lib/types";

export type AiAction = "voice" | "scan" | "insight" | "chat";

export const AI_ACTIONS: AiAction[] = ["voice", "scan", "insight", "chat"];

/** Length of one credit cycle, in days. */
export const CREDIT_CYCLE_DAYS = 30;

/** Fallback per-action costs when the DB row is missing. */
export const DEFAULT_CREDIT_COSTS: Record<AiAction, number> = {
  voice: 1,
  scan: 2,
  insight: 5,
  chat: 1
};

/** Fallback per-cycle allowance when the DB row is missing (null = unlimited). */
export const DEFAULT_PLAN_ALLOWANCE: Record<PlanTier, number | null> = {
  free: 50,
  premium: 1000,
  pro: null
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the cycle-start timestamp that covers `now`. If the stored anchor is
 * older than one full cycle, it is advanced by whole cycles until it contains
 * `now` — this is how the rolling reset works without a cron job.
 */
export function resolveCycleStart(anchorIso: string, now: Date): Date {
  const anchor = new Date(anchorIso);
  const cycleMs = CREDIT_CYCLE_DAYS * 24 * 60 * 60 * 1000;
  const elapsed = now.getTime() - anchor.getTime();
  if (elapsed < cycleMs) return anchor;
  const cyclesToAdvance = Math.floor(elapsed / cycleMs);
  return new Date(anchor.getTime() + cyclesToAdvance * cycleMs);
}

export function cycleEnd(cycleStart: Date): Date {
  return new Date(cycleStart.getTime() + CREDIT_CYCLE_DAYS * 24 * 60 * 60 * 1000);
}

export type CreditDecision =
  | { allowed: true; cost: number; remaining: number | null }
  | {
      allowed: false;
      reason: "insufficient_credits";
      cost: number;
      remaining: number;
      allowance: number;
    };

/**
 * Decides whether an action costing `cost` credits can run given the allowance
 * and how many credits were already used this cycle. A null allowance means
 * unlimited.
 */
export function decideCredit(input: {
  allowance: number | null;
  usedThisCycle: number;
  cost: number;
}): CreditDecision {
  if (input.allowance === null) {
    return { allowed: true, cost: input.cost, remaining: null };
  }
  const remaining = input.allowance - input.usedThisCycle;
  if (remaining < input.cost) {
    return {
      allowed: false,
      reason: "insufficient_credits",
      cost: input.cost,
      remaining: Math.max(0, remaining),
      allowance: input.allowance
    };
  }
  return { allowed: true, cost: input.cost, remaining: remaining - input.cost };
}

// ─── DB-backed operations ─────────────────────────────────────────────────────

async function loadCosts(): Promise<Record<AiAction, number>> {
  try {
    const res = await query<{ action: AiAction; credits: number }>(
      `select action, credits from ai_credit_costs`
    );
    const costs = { ...DEFAULT_CREDIT_COSTS };
    for (const row of res.rows) costs[row.action] = row.credits;
    return costs;
  } catch {
    return { ...DEFAULT_CREDIT_COSTS };
  }
}

async function loadAllowance(plan: PlanTier): Promise<number | null> {
  try {
    const res = await query<{ ai_credits_per_cycle: number | null }>(
      `select ai_credits_per_cycle from plan_limits where plan = $1`,
      [plan]
    );
    if (res.rows.length === 0) return DEFAULT_PLAN_ALLOWANCE[plan];
    return res.rows[0].ai_credits_per_cycle;
  } catch {
    return DEFAULT_PLAN_ALLOWANCE[plan];
  }
}

/** Reads the user's plan and rolling cycle anchor from the entitlement. */
async function loadEntitlement(userId: string): Promise<{ plan: PlanTier; cycleStart: Date }> {
  const res = await query<{
    plan: string;
    status: string;
    current_period_end: string | null;
    ai_credits_cycle_start: string | null;
  }>(
    `select plan, status, current_period_end, ai_credits_cycle_start
     from subscription_entitlements
     where user_id = $1`,
    [userId]
  );

  const now = new Date();
  if (res.rows.length === 0) {
    return { plan: "free", cycleStart: now };
  }

  const row = res.rows[0];
  // An expired paid period effectively downgrades to free.
  const expired = row.current_period_end !== null && new Date(row.current_period_end) <= now;
  const plan = (expired ? "free" : row.plan) as PlanTier;
  const anchorIso = row.ai_credits_cycle_start ?? now.toISOString();
  const cycleStart = resolveCycleStart(anchorIso, now);
  return { plan, cycleStart };
}

async function usedInCycle(userId: string, cycleStart: Date): Promise<number> {
  const res = await query<{ total: string | null }>(
    `select coalesce(sum(credits), 0)::text as total
     from ai_credit_ledger
     where user_id = $1 and created_at >= $2`,
    [userId, cycleStart.toISOString()]
  );
  return Number(res.rows[0]?.total ?? 0);
}

export type CreditBalance = {
  plan: PlanTier;
  allowance: number | null; // null = unlimited
  used: number;
  remaining: number | null; // null = unlimited
  cycleStart: string;
  cycleEnd: string;
  costs: Record<AiAction, number>;
};

/** Returns the current balance snapshot for a user. */
export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  const { plan, cycleStart } = await loadEntitlement(userId);
  const [allowance, used, costs] = await Promise.all([
    loadAllowance(plan),
    usedInCycle(userId, cycleStart),
    loadCosts()
  ]);
  return {
    plan,
    allowance,
    used,
    remaining: allowance === null ? null : Math.max(0, allowance - used),
    cycleStart: cycleStart.toISOString(),
    cycleEnd: cycleEnd(cycleStart).toISOString(),
    costs
  };
}

export type ConsumeResult =
  | { ok: true; cost: number; remaining: number | null }
  | { ok: false; reason: string; cost: number; remaining: number; allowance: number };

/**
 * Attempts to consume the credits for `action`. On success writes a ledger row
 * and returns the new remaining balance. On failure (insufficient credits)
 * returns a rejection with a human-readable reason.
 */
export async function consumeAiCredits(input: {
  userId: string;
  action: AiAction;
  model?: string | null;
}): Promise<ConsumeResult> {
  const { plan, cycleStart } = await loadEntitlement(input.userId);
  const [allowance, used, costs] = await Promise.all([
    loadAllowance(plan),
    usedInCycle(input.userId, cycleStart),
    loadCosts()
  ]);

  const cost = costs[input.action] ?? DEFAULT_CREDIT_COSTS[input.action];
  const decision = decideCredit({ allowance, usedThisCycle: used, cost });

  if (!decision.allowed) {
    return {
      ok: false,
      reason: `Kredit AI habis. Sisa ${decision.remaining} dari ${decision.allowance} kredit untuk siklus ini. Upgrade paket untuk menambah kredit.`,
      cost: decision.cost,
      remaining: decision.remaining,
      allowance: decision.allowance
    };
  }

  await query(
    `insert into ai_credit_ledger (user_id, action, credits, model)
     values ($1, $2, $3, $4)`,
    [input.userId, input.action, cost, input.model ?? null]
  );

  return { ok: true, cost, remaining: decision.remaining };
}
