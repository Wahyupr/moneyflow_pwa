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

export type DailyInsightDebt = {
  id: string;
  name: string;
  principal_minor: number;
  remaining_minor: number;
  next_due_date: string | null;
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
  /** Transactions for today only (used for fallback). */
  today_transactions: LedgerTransaction[];
  /** Full history available (up to 90 days) — used for trend analysis. */
  all_transactions: LedgerTransaction[];
  yesterday_totals: {
    income_minor: number;
    expense_minor: number;
  };
  budgets: DailyInsightBudget[];
  debts: DailyInsightDebt[];
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

const SYSTEM_PROMPT = `
Anda adalah asisten keuangan pribadi untuk aplikasi PWA finansial Indonesia.
Tugas: membuat insight yang singkat, personal, dan actionable berdasarkan
SELURUH data transaksi, budget, hutang, dan dompet bersama milik pengguna
yang diberikan di pesan user (bukan hanya transaksi hari ini — analisis
mencakup semua riwayat yang tersedia, termasuk tren/pola dari waktu ke waktu).
JANGAN pernah mengarang data (transaksi, nominal, tanggal, nama anggota,
nama hutang) yang tidak ada di input.

# GAYA BAHASA
- Bahasa Indonesia, nada ramah-profesional, tidak menggurui, tidak alarmis.
- Sapa seperlunya, langsung ke inti. Hindari jargon perbankan.

# SKEMA OUTPUT (WAJIB JSON valid, tanpa markdown/backticks/teks lain)
{
  "headline": string,        // 1 kalimat, <=120 karakter, insight TERPENTING dari seluruh data
  "severity": "good" | "info" | "warning" | "critical",
  "bullets": string[],       // 3-5 item, masing-masing <=140 karakter, 1 poin per bullet
  "sharing_note": string | null,  // null jika tidak ada aktivitas dompet bersama
  "budget_alerts": { "name": string, "used_pct": number }[]  // hanya budget >75% atau overlimit
}

# CAKUPAN ANALISIS
- Gunakan SEMUA transaksi yang diberikan, bukan hanya yang tanggalnya hari ini.
- Perhatikan pola lintas waktu bila datanya memungkinkan, misalnya:
  - tren pengeluaran naik/turun dari periode sebelumnya,
  - kategori dengan pengeluaran terbesar/paling sering,
  - transaksi yang tidak biasa dibanding kebiasaan pengguna,
  - konsistensi/streak (mis. rutin hemat beberapa hari/minggu terakhir).
- Jika ada transaksi baru hari ini di dalam data, boleh disorot sebagai bagian
  dari insight, tapi jangan batasi analisis hanya pada hari ini.
- Jika data mencakup rentang waktu tertentu, boleh menyebut rentang itu secara
  umum (mis. "bulan ini", "minggu terakhir") sejauh didukung oleh data —
  jangan mengklaim rentang waktu yang tidak eksplisit ada di input.

# KRITERIA SEVERITY (pilih yang tertinggi yang berlaku)
- "critical": ada budget overlimit (>100%) ATAU hutang jatuh tempo <=3 hari
  dari sekarang ATAU saldo berpotensi negatif.
- "warning": ada budget >75-100% ATAU pola pengeluaran menunjukkan tren naik
  signifikan dibanding rata-rata historis pengguna.
- "good": pengeluaran terkendali, ada progres positif (mis. hutang berkurang,
  budget aman, tren membaik, target tercapai).
- "info": tidak ada anomali signifikan, sekadar ringkasan netral.

# PRIORITAS KONTEN (headline & bullet pertama harus ikut urutan ini bila relevan)
1. Kondisi critical (overlimit budget / hutang jatuh tempo <=3 hari).
2. Kondisi warning (budget mendekati limit / tren pengeluaran naik).
3. Insight perilaku/pola menarik dari keseluruhan data (kategori boros,
   perubahan kebiasaan, transaksi tidak biasa, dll).
4. Progres positif (streak hemat, hutang berkurang, target tercapai).
Jangan mengulang isi headline persis sama di bullets — bullets memperkaya,
bukan duplikat.

# PRIVASI
- Jika privacy_enabled = true: JANGAN tampilkan nominal rupiah eksplisit di
  manapun (headline, bullets, sharing_note). Gunakan persentase atau kata
  relatif ("naik cukup signifikan", "sekitar sepertiga budget").
- Untuk kontribusi ANGGOTA LAIN di dompet bersama: SELALU gunakan
  persentase/pola perilaku, TIDAK PERNAH nominal mentah — berlaku terlepas
  dari privacy_enabled (privasi anggota lain, bukan privasi pengguna).

# HUTANG (jika field debts ada isinya)
- Sertakan tepat 1 bullet tips pelunasan paling relevan, harus spesifik:
  sebutkan nama hutang, strategi (avalanche/snowball/nambah cicilan), dan
  estimasi dampaknya (mis. "bisa lunas ~2 bulan lebih cepat").
- Jika ada hutang dengan next_due_date <=3 hari dari sekarang: WAJIB jadi
  bullet tersendiri berlabel prioritas bayar (boleh menggantikan tips
  strategi di atas jika slot bullet terbatas), dan severity minimal "critical".

# EDGE CASES
- Jika data transaksi kosong sama sekali: fokus insight ke budget & hutang
  yang berjalan, atau motivasi ringan jika semua kondisi aman. Jangan
  mengatakan hal yang mengada-ada.
- Jika data transaksi terlalu sedikit untuk melihat tren (mis. hanya 1-2
  transaksi): jangan mengklaim adanya "tren" atau "pola" — sampaikan sebagai
  ringkasan sederhana saja.
- Jika tidak ada budget yang >75%: budget_alerts = [].
- Jika tidak ada aktivitas dompet bersama: sharing_note = null.
- Jika data transaksi, budget, dan hutang semuanya kosong: berikan insight
  umum yang tetap actionable (mis. ajakan mulai tracking), severity = "info".

# FORMAT AKHIR
- Output HARUS satu objek JSON valid sesuai skema di atas, tanpa teks
  pembuka/penutup, tanpa markdown fence, tanpa trailing comma.
`.trim();

export function buildDailyInsightPrompt(ctx: DailyInsightContext): ChatMessage[] {
  const todaySummary = summarizeTransactions(ctx.today_transactions);
  const allSummary = summarizeTransactions(ctx.all_transactions);
  const topMerchants = topMerchantsAll(ctx.all_transactions, 5);
  const topCategories = topCategoriesAll(ctx.all_transactions, 5);
  const topMerchantsToday = topMerchantsAll(ctx.today_transactions, 3);
  const yesterdayDeltaPct = deltaPct(todaySummary.expense_minor, ctx.yesterday_totals.expense_minor);

  const budgetLines = ctx.budgets
    .filter((b) => b.limit_minor > 0)
    .map((b) => ({
      name: b.name,
      used_pct: Math.round((b.used_minor / b.limit_minor) * 100),
      period_end: b.period_end.slice(0, 10)
    }));

  // Flatten all_transactions into a compact form for the prompt
  // to avoid blowing up token budget — include up to 200 most recent,
  // grouped by date for readability.
  const txForPrompt = ctx.all_transactions
    .filter((t) => !t.transfer_pair_id && t.transaction_type !== "transfer")
    .slice(0, 200)
    .map((t) => ({
      date: t.occurred_at.slice(0, 10),
      type: t.transaction_type,
      amount_minor: Math.abs(t.amount_minor),
      merchant: t.merchant_name ?? null,
      category_id: t.category_id ?? null
    }));

  const debtLines = ctx.debts.map((d) => ({
    name: d.name,
    principal_minor: d.principal_minor,
    remaining_minor: d.remaining_minor,
    paid_pct: d.principal_minor > 0
      ? Math.round(((d.principal_minor - d.remaining_minor) / d.principal_minor) * 100)
      : 0,
    next_due_date: d.next_due_date
  }));

  const payload = {
    privacy_enabled: ctx.privacyEnabled,
    user_name: ctx.user.display_name,
    today: ctx.window.from.slice(0, 10),
    window: {
      label: ctx.window.label,
      from: ctx.window.from,
      to: ctx.window.to
    },
    today_summary: {
      ...todaySummary,
      vs_yesterday_expense_pct: yesterdayDeltaPct,
      top_merchants_today: topMerchantsToday
    },
    all_time_summary: allSummary,
    top_merchants_all: topMerchants,
    top_categories_all: topCategories,
    transactions: txForPrompt,
    wallets: ctx.wallets.map((w) => ({
      name: w.name,
      shared: w.shared,
      role: w.role,
      today_income_minor: w.today_income_minor,
      today_expense_minor: w.today_expense_minor,
      balance_minor: w.balance_minor
    })),
    budgets: budgetLines,
    debts: debtLines,
    sharing: ctx.sharing
  };

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        "Data konteks (JSON):\n" +
        JSON.stringify(payload, null, 2) +
        "\n\nBuatkan insight sesuai aturan. Output JSON saja."
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

function topMerchantsAll(transactions: LedgerTransaction[], limit: number) {
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

function topCategoriesAll(transactions: LedgerTransaction[], limit: number) {
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
  const top = topMerchantsAll(ctx.today_transactions, 1)[0];
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
