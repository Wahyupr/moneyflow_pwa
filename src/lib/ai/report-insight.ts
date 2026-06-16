/**
 * Report (Excel) insight builder.
 *
 * Same pattern as `src/lib/ai/insight.ts` but for the longer-range Excel
 * report sheet. The prompt gives the model full aggregate data (totals,
 * categories, merchants, trend, savings rate) and asks for a structured
 * deep-dive: executive summary, strengths, concerns, anomalies,
 * recommendations with potential savings, and a forecast for the next period.
 *
 * Pure functions only — the route handler does the actual AI call.
 */

import type { CategoryBreakdownRow, MerchantRow, ReportData, TrendRow } from "@/lib/reports-data";
import type { ChatMessage } from "@/lib/ai/insight-client";

export type ReportInsightContext = {
  user: { id: string; display_name: string | null };
  window: { description: string; is_custom_range: boolean; from_iso: string; to_iso: string };
  totals: ReportData["totals"];
  previous_totals: ReportData["previous_totals"];
  by_category: CategoryBreakdownRow[];
  top_merchants: MerchantRow[];
  trend: TrendRow[];
};

export type ReportRecommendation = {
  title: string;
  rationale: string;
  /** Optional estimated monthly saving in minor units (rupiah). */
  potential_saving_minor?: number;
};

export type ReportForecast = {
  next_period_expense_minor: number;
  /** 0-1, AI's stated confidence. */
  confidence: number;
  assumptions: string[];
};

export type ParsedReportInsight = {
  /** 2-3 sentence professional summary of the period. */
  executive_summary: string;
  /** 3-5 positive patterns observed. */
  strengths: string[];
  /** 3-5 negative patterns / risks. */
  concerns: string[];
  /** Unusual transactions or outlier patterns. */
  anomalies: string[];
  /** Actionable advice with rationale. */
  recommendations: ReportRecommendation[];
  /** Optional projection for the next comparable period. */
  forecast: ReportForecast | null;
};

const SYSTEM_PROMPT = [
  "Anda adalah financial advisor profesional untuk aplikasi keuangan pribadi Indonesia.",
  "Tugas Anda: menganalisis data keuangan satu periode dan menghasilkan insight mendalam untuk sheet Excel.",
  "Aturan output WAJIB:",
  "- Bahasa Indonesia formal-profesional, nada objektif (tidak menggurui).",
  "- Tulis JSON saja, tanpa markdown, tanpa backticks.",
  "- 'executive_summary' = 2-3 kalimat ringkasan utama periode ini.",
  "- 'strengths' = array 3-5 string pola positif yang teramati.",
  "- 'concerns' = array 3-5 string pola negatif atau risiko.",
  "- 'anomalies' = array string transaksi/pola yang unusual (bisa kosong).",
  "- 'recommendations' = array { title, rationale, potential_saving_minor? } (3-5 item actionable).",
  "- 'forecast' = { next_period_expense_minor, confidence (0.4-0.7), assumptions[] } ATAU null.",
  "Panduan:",
  "- Gunakan nominal rupiah eksplisit (di Excel user sudah lihat angka).",
  "- 'potential_saving_minor' adalah rupiah utuh (bukan sen), realistis bukan promo.",
  "- 'anomalies' fokus pada lonjakan kategori/merchant (>50% di atas rata-rata), duplikasi, atau timing janggal.",
  "- Forecast wajib punya confidence 0.4-0.7 dan minimal 2 asumsi.",
  "- Hindari disclaimer generik. Fokus pada insight yang actionable."
].join("\n");

export function buildReportInsightPrompt(ctx: ReportInsightContext): ChatMessage[] {
  const payload = {
    user_name: ctx.user.display_name,
    periode: ctx.window.description,
    is_custom_range: ctx.window.is_custom_range,
    from: ctx.window.from_iso,
    to: ctx.window.to_iso,
    totals: {
      income_minor: ctx.totals.income_minor,
      expense_minor: ctx.totals.expense_minor,
      net_minor: ctx.totals.net_minor,
      savings_rate_pct: ctx.totals.savings_rate_pct,
      transaction_count: ctx.totals.transaction_count
    },
    previous_period_totals: {
      income_minor: ctx.previous_totals.income_minor,
      expense_minor: ctx.previous_totals.expense_minor,
      net_minor: ctx.previous_totals.net_minor
    },
    delta_pct: {
      income: deltaPct(ctx.totals.income_minor, ctx.previous_totals.income_minor),
      expense: deltaPct(ctx.totals.expense_minor, ctx.previous_totals.expense_minor),
      net: deltaPct(ctx.totals.net_minor, ctx.previous_totals.net_minor)
    },
    top_categories: ctx.by_category.slice(0, 8).map((c) => ({
      name: c.category_name,
      expense_minor: c.expense_minor,
      pct: c.expense_pct,
      transaction_count: c.transaction_count
    })),
    top_merchants: ctx.top_merchants.slice(0, 10).map((m) => ({
      name: m.name,
      expense_minor: m.expense_minor,
      transaction_count: m.transaction_count,
      avg_per_transaction_minor: m.transaction_count > 0
        ? Math.round(m.expense_minor / m.transaction_count)
        : 0
    })),
    trend_6_months: ctx.trend.map((t) => ({
      month: t.month,
      income_minor: t.income_minor,
      expense_minor: t.expense_minor
    }))
  };

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        "Data periode (JSON):\n" +
        JSON.stringify(payload, null, 2) +
        "\n\nAnalisis dan buatkan output sesuai aturan. JSON saja."
    }
  ];
}

function deltaPct(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function parseReportInsightResponse(content: string): ParsedReportInsight {
  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
  const json = JSON.parse(cleaned) as Record<string, unknown>;

  const executive_summary =
    typeof json.executive_summary === "string" ? json.executive_summary.trim() : "";
  if (executive_summary.length === 0) {
    throw new Error("Report insight response missing executive_summary.");
  }

  const asStringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];

  const strengths = asStringArray(json.strengths).slice(0, 5);
  const concerns = asStringArray(json.concerns).slice(0, 5);
  const anomalies = asStringArray(json.anomalies);

  const recommendations: ReportRecommendation[] = Array.isArray(json.recommendations)
    ? json.recommendations
        .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
        .map((r) => {
          const title = typeof r.title === "string" ? r.title.trim() : "";
          const rationale = typeof r.rationale === "string" ? r.rationale.trim() : "";
          const savingRaw = Number(r.potential_saving_minor);
          const potential_saving_minor =
            Number.isFinite(savingRaw) && savingRaw > 0 ? Math.round(savingRaw) : undefined;
          return { title, rationale, potential_saving_minor };
        })
        .filter((r) => r.title && r.rationale)
        .slice(0, 6)
    : [];

  let forecast: ReportForecast | null = null;
  if (typeof json.forecast === "object" && json.forecast !== null) {
    const f = json.forecast as Record<string, unknown>;
    const nextRaw = Number(f.next_period_expense_minor);
    const confRaw = Number(f.confidence);
    const assumptions = asStringArray(f.assumptions);
    if (Number.isFinite(nextRaw) && nextRaw > 0 && Number.isFinite(confRaw)) {
      forecast = {
        next_period_expense_minor: Math.round(nextRaw),
        // Clamp confidence to [0.1, 0.95] — model sometimes overstates.
        confidence: Math.min(0.95, Math.max(0.1, confRaw)),
        assumptions: assumptions.length > 0 ? assumptions : ["Berdasarkan rata-rata tren historis."]
      };
    }
  }

  return { executive_summary, strengths, concerns, anomalies, recommendations, forecast };
}

/**
 * Deterministic fallback used when the AI gateway is unavailable or returns
 * invalid JSON. Keeps the Excel "AI Insight" sheet non-empty.
 */
export function fallbackReportInsight(ctx: ReportInsightContext): ParsedReportInsight {
  const totals = ctx.totals;
  const prev = ctx.previous_totals;
  const savings = totals.savings_rate_pct;
  const expenseDelta = deltaPct(totals.expense_minor, prev.expense_minor);
  const incomeDelta = deltaPct(totals.income_minor, prev.income_minor);

  const executive_summary =
    `Pada periode ${ctx.window.description}, ` +
    `Anda mencatat ${totals.transaction_count} transaksi dengan ` +
    `pemasukan Rp${totals.income_minor.toLocaleString("id-ID")} dan ` +
    `pengeluaran Rp${totals.expense_minor.toLocaleString("id-ID")}, ` +
    `menghasilkan net Rp${totals.net_minor.toLocaleString("id-ID")}. ` +
    (expenseDelta > 10
      ? `Pengeluaran naik ${expenseDelta}% dibanding periode sebelumnya.`
      : expenseDelta < -10
        ? `Pengeluaran turun ${Math.abs(expenseDelta)}% dibanding periode sebelumnya.`
        : `Pengeluaran relatif stabil dibanding periode sebelumnya.`);

  const strengths: string[] = [];
  if (savings >= 20) strengths.push(`Tingkat tabung ${savings}% termasuk sehat (>20%).`);
  if (incomeDelta > 0) strengths.push(`Pemasukan naik ${incomeDelta}% dari periode sebelumnya.`);
  if (expenseDelta < 0) strengths.push(`Pengeluaran turun ${Math.abs(expenseDelta)}% dari periode sebelumnya.`);
  const topCat = ctx.by_category[0];
  if (topCat && topCat.expense_pct < 40) {
    strengths.push(`Diversifikasi pengeluaran baik (kategori terbesar hanya ${topCat.expense_pct}%).`);
  }
  while (strengths.length < 3) strengths.push("Tidak ada kategori dengan lonjakan ekstrem terdeteksi.");

  const concerns: string[] = [];
  if (savings < 10) concerns.push(`Tingkat tabung ${savings}% di bawah rekomendasi minimum (20%).`);
  if (expenseDelta > 20) concerns.push(`Pengeluaran naik signifikan (${expenseDelta}%) — perlu evaluasi.`);
  if (incomeDelta < 0) concerns.push(`Pemasukan turun ${Math.abs(incomeDelta)}% dari periode sebelumnya.`);
  if (topCat && topCat.expense_pct > 50) {
    concerns.push(`Kategori "${topCat.category_name}" mendominasi ${topCat.expense_pct}% pengeluaran (risiko konsentrasi).`);
  }
  while (concerns.length < 3) concerns.push("Tidak ada anomali mencurigakan yang terdeteksi otomatis.");

  const anomalies: string[] = [];
  // Simple anomaly: merchants with single transaction > 30% of total expense.
  for (const m of ctx.top_merchants) {
    if (totals.expense_minor > 0 && m.expense_minor / totals.expense_minor > 0.3) {
      anomalies.push(
        `Merchant "${m.name}" menyerap ${Math.round((m.expense_minor / totals.expense_minor) * 100)}% total pengeluaran.`
      );
    }
  }

  const recommendations: ReportRecommendation[] = [];
  if (topCat && topCat.expense_pct > 30) {
    recommendations.push({
      title: `Tinjau kategori "${topCat.category_name}"`,
      rationale: `Kategori ini menyumbang ${topCat.expense_pct}% pengeluaran. Evaluasi rincian untuk cari peluang penghematan.`,
      potential_saving_minor: Math.round(topCat.expense_minor * 0.1)
    });
  }
  if (savings < 20) {
    recommendations.push({
      title: "Tingkatkan target tabungan ke 20%",
      rationale: `Saatnya tingkat tabung ${savings}%. Sisihkan selisih ke dompet tabungan otomatis di awal bulan.`,
      potential_saving_minor: Math.round(totals.income_minor * 0.05)
    });
  }
  if (ctx.top_merchants[0]) {
    const m = ctx.top_merchants[0];
    recommendations.push({
      title: `Evaluasi pengeluaran di "${m.name}"`,
      rationale: `Merchant teratas dengan ${m.transaction_count} transaksi. Cek apakah ada pola berulang yang bisa dikurangi.`
    });
  }
  while (recommendations.length < 3) {
    recommendations.push({
      title: "Pertahankan kebiasaan pencatatan",
      rationale: "Konsistensi pencatatan adalah pondasi pengelolaan keuangan yang baik."
    });
  }

  const trend = ctx.trend;
  let forecast: ReportForecast | null = null;
  if (trend.length >= 3) {
    const recent = trend.slice(-3);
    const avg = recent.reduce((s, t) => s + t.expense_minor, 0) / recent.length;
    forecast = {
      next_period_expense_minor: Math.round(avg),
      confidence: 0.5,
      assumptions: [
        "Tidak ada perubahan signifikan dalam pola konsumsi.",
        `Berdasarkan rata-rata pengeluaran ${recent.length} bulan terakhir.`
      ]
    };
  }

  return { executive_summary, strengths, concerns, anomalies, recommendations, forecast };
}
