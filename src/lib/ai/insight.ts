/**
 * Daily insight prompt builder + response parser.
 *
 * Pure functions (no I/O) so they can be unit-tested without mocking the
 * client. The actual AI call lives in `src/app/api/dashboard/insight/route.ts`
 * and uses `chatCompletion` from `@/lib/ai/insight-client`.
 *
 * Design notes:
 * - When `privacyEnabled` is true, prompts instruct the model to describe
 *   amounts as relative changes / percentages only (no raw rupiah) so a
 *   shoulder-surfer cannot read nominal off the screen.
 * - Sharing-wallet contributions from OTHER members are always described as
 *   patterns, never raw numbers — user only sees their own nominal clearly.
 */

import type { LedgerTransaction } from "@/lib/types";
import type { ChatMessage } from "@/lib/ai/insight-client";

export type DailyInsightWindow = {
  from: string; // ISO timestamptz
  to: string; // ISO timestamptz
  /** "today" = current calendar day so far; "yesterday" = full previous day. */
  label: "today" | "yesterday";
};

export type DailyInsightWallet = {
  id: string;
  name: string;
  shared: boolean;
  /** Role of the current user in this wallet (null for owned wallets). */
  role: "owner" | "member" | "viewer" | null;
  today_income_minor: number;
  today_expense_minor: number;
  balance_minor: number;
};

export type DailyInsightBudget = {
  id: string;
  name: string;
  used_minor: number;
  limit_minor: number;
  /** ISO date when the budget period ends. */
  period_end: string;
};

export type DailyInsightSharingContribution = {
  /** Count of shared wallets the user participates in. */
  shared_wallets_count: number;
  /** Total the user contributed (their own expense txns) into shared wallets today. */
  user_contributed_minor: number;
  /** Total expense into shared wallets today that came from OTHER members. */
  others_contributed_minor: number;
};

export type DailyInsightContext = {
  user: { id: string; display_name: string | null };
  window: DailyInsightWindow;
  privacyEnabled: boolean;
  wallets: DailyInsightWallet[];
  today_transactions: LedgerTransaction[];
  yesterday_totals: {
    income_minor: number;
    expense_minor: number;
  };
  budgets: DailyInsightBudget[];
  sharing: DailyInsightSharingContribution;
};

export type DailyInsightSeverity = "good" | "info" | "warning" | "critical";

export type DailyInsightBudgetAlert = {
  name: string;
  /** Percentage of limit used, 0-100+ (100+ means over-budget). */
  used_pct: number;
};

export type ParsedDailyInsight = {
  /** One-sentence headline (<= 120 chars) — the most important takeaway. */
  headline: string;
  severity: DailyInsightSeverity;
  /** 3-5 short bullets, each <= 140 chars. */
  bullets: string[];
  /** Optional note specifically about shared-wallet activity today. */
  sharing_note: string | null;
  /** Budgets flagged because they crossed 75% usage or are over limit. */
  budget_alerts: DailyInsightBudgetAlert[];
};

const SYSTEM_PROMPT = [
  "Anda adalah asisten keuangan pribadi untuk aplikasi PWA finansial Indonesia.",
  "Tugas Anda: membuat insight harian yang singkat, personal, dan actionable berdasarkan transaksi hari ini.",
  "Aturan output WAJIB:",
  "- Bahasa Indonesia, nada ramah profesional (tidak menggurui).",
  "- Tulis JSON saja, tanpa markdown, tanpa backticks.",
  "- 'headline' = 1 kalimat utama (<= 120 karakter), fokus pada 1 insight paling penting hari ini.",
  "- 'severity' = 'good' | 'info' | 'warning' | 'critical'.",
  "- 'bullets' = array 3-5 string pendek (masing-masing <= 140 karakter), 1 poin per bullet.",
  "- 'sharing_note' = string (atau null jika tidak ada aktivitas dompet bersama).",
  "- 'budget_alerts' = array { name, used_pct (angka 0-100+) } untuk budget yang sudah >75% atau overlimit.",
  "Hindari nominal rupiah eksplisit jika flag privacy_enabled = true (gunakan persentase / kata relatif).",
  "Untuk kontribusi ANGGOTA LAIN di dompet bersama, SELALU gunakan persentase/pola — jangan nominal mentah."
].join("\n");

export function buildDailyInsightPrompt(ctx: DailyInsightContext): ChatMessage[] {
  const today = summarizeTransactions(ctx.today_transactions);
  const topMerchants = topMerchantsToday(ctx.today_transactions, 3);
  const topCategories = topCategoriesToday(ctx.today_transactions, 3);
  const yesterdayDeltaPct = deltaPct(today.expense_minor, ctx.yesterday_totals.expense_minor);

  const budgetLines = ctx.budgets
    .filter((b) => b.limit_minor > 0)
    .map((b) => ({
      name: b.name,
      used_pct: Math.round((b.used_minor / b.limit_minor) * 100),
      period_end: b.period_end.slice(0, 10)
    }));

  const payload = {
    privacy_enabled: ctx.privacyEnabled,
    user_name: ctx.user.display_name,
    window: {
      label: ctx.window.label,
      from: ctx.window.from,
      to: ctx.window.to
    },
    today_summary: {
      ...today,
      vs_yesterday_expense_pct: yesterdayDeltaPct
    },
    yesterday_summary: ctx.yesterday_totals,
    top_merchants_today: topMerchants,
    top_categories_today: topCategories,
    wallets: ctx.wallets.map((w) => ({
      name: w.name,
      shared: w.shared,
      role: w.role,
      today_income_minor: w.today_income_minor,
      today_expense_minor: w.today_expense_minor,
      balance_minor: w.balance_minor
    })),
    budgets: budgetLines,
    sharing: ctx.sharing
  };

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        "Data konteks (JSON):\n" +
        JSON.stringify(payload, null, 2) +
        "\n\nBuatkan insight harian sesuai aturan. Output JSON saja."
    }
  ];
}

function summarizeTransactions(transactions: LedgerTransaction[]): {
  income_minor: number;
  expense_minor: number;
  net_minor: number;
  transaction_count: number;
  largest_expense_minor: number;
} {
  let income = 0;
  let expense = 0;
  let largest = 0;
  let count = 0;
  for (const tx of transactions) {
    if (tx.transfer_pair_id || tx.transaction_type === "transfer") continue;
    count += 1;
    const amount = Math.abs(tx.amount_minor);
    if (tx.transaction_type === "income") {
      income += amount;
    } else if (tx.transaction_type === "expense") {
      expense += amount;
      if (amount > largest) largest = amount;
    }
  }
  return {
    income_minor: income,
    expense_minor: expense,
    net_minor: income - expense,
    transaction_count: count,
    largest_expense_minor: largest
  };
}

function topMerchantsToday(transactions: LedgerTransaction[], limit: number) {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.transaction_type !== "expense" || tx.transfer_pair_id) continue;
    const key = (tx.merchant_name ?? "Tanpa nama").trim();
    map.set(key, (map.get(key) ?? 0) + Math.abs(tx.amount_minor));
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, expense_minor]) => ({ name, expense_minor }));
}

function topCategoriesToday(transactions: LedgerTransaction[], limit: number) {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.transaction_type !== "expense" || tx.transfer_pair_id) continue;
    const key = tx.category_id ?? "uncategorized";
    map.set(key, (map.get(key) ?? 0) + Math.abs(tx.amount_minor));
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([category_id, expense_minor]) => ({ category_id, expense_minor }));
}

function deltaPct(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

const VALID_SEVERITIES: ReadonlySet<DailyInsightSeverity> = new Set([
  "good",
  "info",
  "warning",
  "critical"
]);

/**
 * Parses and validates the AI response. Throws if the JSON shape is invalid
 * so the route handler can fall back to a deterministic template insight.
 */
export function parseDailyInsightResponse(content: string): ParsedDailyInsight {
  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  const json = JSON.parse(cleaned) as Record<string, unknown>;

  const headline = typeof json.headline === "string" ? json.headline.trim() : "";
  if (headline.length === 0) {
    throw new Error("Insight response missing headline.");
  }

  const severityRaw = typeof json.severity === "string" ? json.severity : "info";
  const severity: DailyInsightSeverity = VALID_SEVERITIES.has(severityRaw as DailyInsightSeverity)
    ? (severityRaw as DailyInsightSeverity)
    : "info";

  const bullets = Array.isArray(json.bullets)
    ? json.bullets
        .filter((b): b is string => typeof b === "string")
        .map((b) => b.trim())
        .filter((b) => b.length > 0)
        .slice(0, 5)
    : [];

  const sharing_note =
    typeof json.sharing_note === "string" && json.sharing_note.trim().length > 0
      ? json.sharing_note.trim()
      : null;

  const budget_alerts: DailyInsightBudgetAlert[] = Array.isArray(json.budget_alerts)
    ? json.budget_alerts
        .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null)
        .map((b) => ({
          name: typeof b.name === "string" ? b.name : "Budget",
          used_pct: Number.isFinite(Number(b.used_pct)) ? Math.max(0, Number(b.used_pct)) : 0
        }))
        .slice(0, 10)
    : [];

  return { headline, severity, bullets, sharing_note, budget_alerts };
}

/**
 * Deterministic fallback used when the gateway is down, returns invalid JSON,
 * or times out. Keeps the dashboard functional even without AI.
 */
export function fallbackDailyInsight(ctx: DailyInsightContext): ParsedDailyInsight {
  const today = summarizeTransactions(ctx.today_transactions);
  const deltaPctVsYesterday = deltaPct(today.expense_minor, ctx.yesterday_totals.expense_minor);

  const headline =
    today.transaction_count === 0
      ? "Belum ada transaksi hari ini."
      : deltaPctVsYesterday > 20
        ? `Pengeluaran naik ${deltaPctVsYesterday}% dari kemarin.`
        : deltaPctVsYesterday < -20 && today.expense_minor > 0
          ? `Pengeluaran turun ${Math.abs(deltaPctVsYesterday)}% dari kemarin.`
          : "Arus kas hari ini terkendali.";

  const severity: DailyInsightSeverity =
    deltaPctVsYesterday > 50 ? "warning" : deltaPctVsYesterday < -20 ? "good" : "info";

  const bullets: string[] = [];
  if (today.transaction_count > 0) {
    bullets.push(`${today.transaction_count} transaksi tercatat hari ini.`);
  }
  const top = topMerchantsToday(ctx.today_transactions, 1)[0];
  if (top) {
    bullets.push(`Merchant teratas: ${top.name}.`);
  }
  const overBudget = ctx.budgets
    .filter((b) => b.limit_minor > 0 && b.used_minor / b.limit_minor >= 0.75)
    .slice(0, 2);
  for (const b of overBudget) {
    const pct = Math.round((b.used_minor / b.limit_minor) * 100);
    bullets.push(`Budget "${b.name}" sudah terpakai ${pct}%.`);
  }
  if (ctx.sharing.shared_wallets_count > 0) {
    bullets.push(`${ctx.sharing.shared_wallets_count} dompet bersama aktif hari ini.`);
  }
  while (bullets.length < 3) {
    bullets.push("Pantau pengeluaran rutin untuk menjaga cashflow.");
  }

  const budget_alerts: DailyInsightBudgetAlert[] = ctx.budgets
    .filter((b) => b.limit_minor > 0 && b.used_minor / b.limit_minor >= 0.75)
    .map((b) => ({
      name: b.name,
      used_pct: Math.round((b.used_minor / b.limit_minor) * 100)
    }));

  const sharing_note =
    ctx.sharing.shared_wallets_count > 0
      ? `Aktivitas dompet bersama terpantau hari ini.`
      : null;

  return {
    headline: headline.slice(0, 120),
    severity,
    bullets: bullets.slice(0, 5).map((b) => b.slice(0, 140)),
    sharing_note,
    budget_alerts
  };
}
