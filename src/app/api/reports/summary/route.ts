import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { fetchReportData, resolveReportWindow } from "@/lib/reports-data";

export const runtime = "nodejs";

/**
 * GET /api/reports/summary
 *
 * Query params (choose one style):
 *   month=YYYY-MM          → single calendar month (default: current month)
 *   from=YYYY-MM-DD&to=YYYY-MM-DD → arbitrary date range
 *
 * Returns totals, category breakdown, top merchants, 6-month trend.
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

  try {
    const data = await fetchReportData(auth.db, auth.user.id, window);

    // Backwards-compat shape: top-level fields match the old contract.
    return NextResponse.json({
      month: data.window.month,
      totals: data.totals,
      previous_totals: data.previous_totals,
      by_category: data.by_category,
      top_merchants: data.top_merchants,
      trend: data.trend,
      window: {
        description: data.window.description,
        is_custom_range: data.window.isCustomRange,
        from: data.window.fromIso,
        to: data.window.toIso
      },
      generated_at: data.generated_at
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal memuat laporan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
