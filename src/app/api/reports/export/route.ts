import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { fetchReportData, resolveReportWindow } from "@/lib/reports-data";
import {
  buildReportInsightPrompt,
  fallbackReportInsight,
  parseReportInsightResponse,
  type ReportInsightContext,
  type ParsedReportInsight
} from "@/lib/ai/report-insight";
import { chatCompletion, getInsightConfig } from "@/lib/ai/insight-client";
import { buildReportWorkbook } from "@/lib/excel/report-workbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reports/export
 *
 * Query params (same as /api/reports/summary):
 *   month=YYYY-MM                              → single calendar month
 *   from=YYYY-MM-DD&to=YYYY-MM-DD              → arbitrary range
 *
 * Streams a .xlsx download with 6 themed sheets including an AI Insight
 * sheet generated for the same window.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  const window = resolveReportWindow({
    month: searchParams.get("month"),
    from: searchParams.get("from"),
    to: searchParams.get("to")
  });

  let data;
  try {
    data = await fetchReportData(auth.db, auth.user.id, window);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memuat data laporan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Build AI insight for the range. Errors fall back to deterministic insight
  // so the "AI Insight" sheet is never empty.
  const insightContext: ReportInsightContext = {
    user: { id: auth.user.id, display_name: auth.user.user_metadata.display_name },
    window: {
      description: data.window.description,
      is_custom_range: data.window.isCustomRange,
      from_iso: data.window.fromIso,
      to_iso: data.window.toIso
    },
    totals: data.totals,
    previous_totals: data.previous_totals,
    by_category: data.by_category,
    top_merchants: data.top_merchants,
    trend: data.trend
  };

  let insight: ParsedReportInsight;
  let modelLabel: string;

  try {
    const messages = buildReportInsightPrompt(insightContext);
    const result = await chatCompletion(messages, {
      maxTokens: 2200,
      temperature: 0.5,
      timeoutMs: 25_000
    });
    insight = parseReportInsightResponse(result.content);
    modelLabel = result.model;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "AI call failed.";
    insight = fallbackReportInsight(insightContext);
    const cfg = getInsightConfig();
    modelLabel = `${cfg.model} (fallback: ${reason.slice(0, 60)})`;
  }

  const buffer = await buildReportWorkbook(data, insight, {
    userName: auth.user.user_metadata.display_name,
    aiModelLabel: modelLabel
  });

  const filename = buildFilename(window);
  const safeFilename = encodeURIComponent(filename);
  const bytes = new Uint8Array(buffer);

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${safeFilename}`,
      "Cache-Control": "no-store, max-age=0",
      "Content-Length": String(bytes.byteLength)
    }
  });
}

function buildFilename(window: ReturnType<typeof resolveReportWindow>): string {
  if (window.isCustomRange) {
    const from = window.fromIso.slice(0, 10);
    const toExclusive = window.toIso.slice(0, 10);
    // toIso is exclusive next-day; subtract 1 day for label.
    const toDate = new Date(Date.parse(window.toIso) - 24 * 60 * 60 * 1000);
    const to = toDate.toISOString().slice(0, 10);
    void toExclusive;
    return `laporan-keuangan_${from}_to_${to}.xlsx`;
  }
  return `laporan-keuangan_${window.month}.xlsx`;
}
