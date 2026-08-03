/**
 * Excel workbook generator for the personal-finance report download.
 *
 * Redesigned into a focused two-sheet layout (down from six):
 *
 *   1. "Laporan"   — a single dashboard-style page combining:
 *                      • KPI cards (income, expense, net, savings rate, tx count)
 *                      • vs-previous-period comparison
 *                      • category breakdown (with unicode bars)
 *                      • top merchants
 *                      • 6-month trend
 *                      • AI narrative insight
 *   2. "Transaksi" — the raw transaction ledger (autofilter + freeze header).
 *
 * A single consistent color theme is used across both sheets. All amount cells
 * use the Indonesian rupiah format.
 */

import ExcelJS from "exceljs";

import type { ReportData, ReportWindow } from "@/lib/reports-data";
import type { ParsedReportInsight } from "@/lib/ai/report-insight";
import { amountMinorToMajor, formatCurrency } from "@/lib/money";
import type { CurrencyCode } from "@/lib/types";

// ─── Theme ────────────────────────────────────────────────────────────────
const THEME = {
  primary: "FF1668DC", // brand blue — headers & banner
  primaryDark: "FF0B3D8C",
  ink: "FF1E293B",
  muted: "FF64748B",
  light: "FFEFF4FF", // banded row / soft fill
  income: "FF10B981",
  expense: "FFEF4444",
  amber: "FFF59E0B",
  border: "FFCBD5E1",
  cardBg: "FFF8FAFC"
} as const;

const CURRENCY_FMT = '"Rp"#,##0;[Red]-"Rp"#,##0';
const PERCENT_FMT = "0.0%";

const TITLE_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 18 };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };

export async function buildReportWorkbook(
  rawData: ReportData,
  insight: ParsedReportInsight | null,
  options: { userName: string | null; aiModelLabel: string | null }
): Promise<Buffer> {
  const data = rawData;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Moneyflow";
  wb.created = new Date();
  wb.title = `Laporan Keuangan ${data.window.description}`;

  buildDashboardSheet(wb, data, insight, options);
  buildTransactionsSheet(wb, data);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ─── Small helpers ──────────────────────────────────────────────────────────

function reportAmount(amountMinor: number): number {
  return amountMinorToMajor(amountMinor, "IDR");
}

function excelCurrencyFormat(currency: CurrencyCode): string {
  if (currency === "IDR") return CURRENCY_FMT;
  return `"${currency}" #,##0.00;[Red]-"${currency}" #,##0.00`;
}

function solid(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function thinBorderAll(argb: string): Partial<ExcelJS.Borders> {
  const side: ExcelJS.Border = { style: "thin", color: { argb } };
  return { top: side, left: side, bottom: side, right: side };
}

/** Auto-fit column widths from cell content across a row range. */
function autoFitColumns(
  ws: ExcelJS.Worksheet,
  columnCount: number,
  startRow: number,
  endRow: number,
  options: { minWidth?: number; maxWidth?: number; padding?: number } = {}
): void {
  const { minWidth = 10, maxWidth = 60, padding = 2 } = options;
  const maxima = new Array<number>(columnCount).fill(0);

  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= columnCount; c++) {
      const raw = row.getCell(c).value;
      let text = "";
      if (typeof raw === "string") text = raw;
      else if (typeof raw === "number") text = Math.round(raw).toString();
      else if (raw instanceof Date) text = raw.toLocaleDateString("id-ID");
      else if (raw && typeof raw === "object" && "text" in raw) text = String((raw as { text: string }).text);
      const visible = text.length > maxWidth ? text.slice(0, maxWidth) : text;
      if (visible.length > maxima[c - 1]) maxima[c - 1] = visible.length;
    }
  }

  for (let c = 1; c <= columnCount; c++) {
    ws.getColumn(c).width = Math.min(maxWidth, Math.max(minWidth, maxima[c - 1] + padding));
  }
}

/** Converts a #RRGGBB (or RRGGBB) string into ARGB with the supplied alpha. */
function hexWithAlpha(hex: string, alpha: string): string {
  const clean = hex.replace(/^#/, "").toUpperCase();
  if (clean.length === 8) return clean;
  if (clean.length !== 6) return `${alpha}94A3B8`;
  return `${alpha}${clean}`;
}

// ─── Section helpers ─────────────────────────────────────────────────────────

/** Draws the full-width gradient-style banner across A1:H2. */
function writeBanner(ws: ExcelJS.Worksheet, title: string, subtitle: string): void {
  ws.mergeCells("A1:H1");
  const t = ws.getCell("A1");
  t.value = title;
  t.font = TITLE_FONT;
  t.fill = solid(THEME.primary);
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 34;

  ws.mergeCells("A2:H2");
  const s = ws.getCell("A2");
  s.value = subtitle;
  s.font = { italic: true, color: { argb: "FFFFFFFF" }, size: 11 };
  s.fill = solid(THEME.primaryDark);
  s.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(2).height = 20;
}

/**
 * Writes a section header bar spanning A..H at the given row. Returns the next
 * free row.
 */
function writeSectionBar(ws: ExcelJS.Worksheet, row: number, label: string): number {
  ws.mergeCells(row, 1, row, 8);
  const cell = ws.getCell(row, 1);
  cell.value = label;
  cell.font = { bold: true, size: 13, color: { argb: THEME.primary } };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  cell.border = { bottom: { style: "medium", color: { argb: THEME.primary } } };
  ws.getRow(row).height = 24;
  return row + 1;
}

/**
 * Draws a compact KPI "card": a 2-row block (label on top, value below) with a
 * tinted background and accent-colored value text, spanning two columns.
 */
function writeKpiCard(
  ws: ExcelJS.Worksheet,
  row: number,
  startCol: number,
  label: string,
  value: number | string,
  numFmt: string | null,
  accent: string
): void {
  const labelCell = ws.getCell(row, startCol);
  labelCell.value = label.toUpperCase();
  labelCell.font = { bold: true, size: 9, color: { argb: THEME.muted } };
  labelCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.mergeCells(row, startCol, row, startCol + 1);

  const valueCell = ws.getCell(row + 1, startCol);
  valueCell.value = value;
  if (numFmt) valueCell.numFmt = numFmt;
  valueCell.font = { bold: true, size: 14, color: { argb: accent } };
  valueCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.mergeCells(row + 1, startCol, row + 1, startCol + 1);

  // Tinted background + border across both merged cells.
  for (let r = row; r <= row + 1; r++) {
    for (let c = startCol; c <= startCol + 1; c++) {
      const cell = ws.getCell(r, c);
      cell.fill = solid(THEME.cardBg);
      cell.border = thinBorderAll(THEME.border);
    }
  }
  ws.getRow(row).height = 16;
  ws.getRow(row + 1).height = 22;
}

/** Column headers for an inline table section, spanning the given labels. */
function writeTableHeader(ws: ExcelJS.Worksheet, row: number, headers: Array<{ label: string; align?: "left" | "right" | "center" }>): void {
  const headerRow = ws.getRow(row);
  headerRow.height = 20;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h.label;
    cell.font = HEADER_FONT;
    cell.fill = solid(THEME.primary);
    cell.alignment = { vertical: "middle", horizontal: h.align ?? "left", indent: 1 };
  });
}

/** Applies a soft banded fill to even data rows across the given column count. */
function bandRows(ws: ExcelJS.Worksheet, startRow: number, endRow: number, cols: number): void {
  for (let r = startRow; r <= endRow; r++) {
    if ((r - startRow) % 2 !== 0) continue;
    for (let c = 1; c <= cols; c++) {
      ws.getCell(r, c).fill = solid(THEME.light);
    }
  }
}

// ─── Sheet 1: Dashboard ──────────────────────────────────────────────────────

function buildDashboardSheet(
  wb: ExcelJS.Workbook,
  data: ReportData,
  insight: ParsedReportInsight | null,
  options: { userName: string | null; aiModelLabel: string | null }
): void {
  const ws = wb.addWorksheet("Laporan", {
    properties: { tabColor: { argb: THEME.primary } },
    views: [{ showGridLines: false }]
  });

  ws.columns = [
    { width: 26 },
    { width: 18 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
    { width: 14 },
    { width: 12 }
  ];

  const userLabel = options.userName ? ` · ${options.userName}` : "";
  writeBanner(ws, "Laporan Keuangan", `${data.window.description}${userLabel}`);

  let row = 4;

  // ── KPI cards ──────────────────────────────────────────────────────────
  row = writeSectionBar(ws, row, "Ringkasan");
  // Row of 3 cards: income / expense / net.
  writeKpiCard(ws, row, 1, "Pemasukan", reportAmount(data.totals.income_minor), CURRENCY_FMT, THEME.income);
  writeKpiCard(ws, row, 3, "Pengeluaran", reportAmount(data.totals.expense_minor), CURRENCY_FMT, THEME.expense);
  writeKpiCard(ws, row, 5, "Net", reportAmount(data.totals.net_minor), CURRENCY_FMT, data.totals.net_minor >= 0 ? THEME.income : THEME.expense);
  row += 2;
  // Row of 2 cards: savings rate / tx count.
  writeKpiCard(
    ws,
    row,
    1,
    "Tingkat Tabung",
    data.totals.savings_rate_pct / 100,
    PERCENT_FMT,
    data.totals.savings_rate_pct >= 20 ? THEME.income : THEME.expense
  );
  writeKpiCard(ws, row, 3, "Jumlah Transaksi", data.totals.transaction_count, null, THEME.primary);
  row += 3;

  // ── vs previous period ───────────────────────────────────────────────────
  row = writeSectionBar(ws, row, "Perbandingan Periode Sebelumnya");
  writeTableHeader(ws, row, [
    { label: "Metrik" },
    { label: "Periode Ini", align: "right" },
    { label: "Periode Lalu", align: "right" },
    { label: "Δ %", align: "right" }
  ]);
  row += 1;

  const comparisonRows: Array<[string, number, number]> = [
    ["Pemasukan", data.totals.income_minor, data.previous_totals.income_minor],
    ["Pengeluaran", data.totals.expense_minor, data.previous_totals.expense_minor],
    ["Net", data.totals.net_minor, data.previous_totals.net_minor]
  ];
  const cmpStart = row;
  for (const [label, current, previous] of comparisonRows) {
    const r = ws.getRow(row);
    r.getCell(1).value = label;
    r.getCell(1).font = { size: 11, color: { argb: THEME.ink } };
    r.getCell(2).value = reportAmount(current);
    r.getCell(2).numFmt = CURRENCY_FMT;
    r.getCell(2).alignment = { horizontal: "right" };
    r.getCell(3).value = reportAmount(previous);
    r.getCell(3).numFmt = CURRENCY_FMT;
    r.getCell(3).alignment = { horizontal: "right" };
    const deltaPct = previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 100);
    const d = r.getCell(4);
    d.value = deltaPct / 100;
    d.numFmt = "+0%;-0%;0%";
    d.font = { bold: true, color: { argb: deltaPct >= 0 ? THEME.income : THEME.expense } };
    d.alignment = { horizontal: "right" };
    row += 1;
  }
  bandRows(ws, cmpStart, row - 1, 4);
  row += 2;

  row = writeCategorySection(ws, data, row);
  row = writeMerchantSection(ws, data, row);
  row = writeTrendSection(ws, data, row);
  writeInsightSection(ws, insight, options, row);
}

// ─── Dashboard sections ──────────────────────────────────────────────────────

function writeCategorySection(ws: ExcelJS.Worksheet, data: ReportData, row: number): number {
  row = writeSectionBar(ws, row, "Breakdown Kategori");
  writeTableHeader(ws, row, [
    { label: "Kategori" },
    { label: "Pengeluaran", align: "right" },
    { label: "%", align: "right" },
    { label: "Visualisasi" },
    { label: "Tx", align: "right" }
  ]);
  row += 1;

  if (data.by_category.length === 0) {
    writeEmptyState(ws, row, "Belum ada pengeluaran pada periode ini.", 5);
    return row + 2;
  }

  const start = row;
  data.by_category.forEach((cat, idx) => {
    const r = ws.getRow(row);
    r.height = 19;
    r.getCell(1).value = cat.category_name;
    r.getCell(1).font = { bold: idx < 3, color: { argb: THEME.ink } };
    r.getCell(2).value = reportAmount(cat.expense_minor);
    r.getCell(2).numFmt = CURRENCY_FMT;
    r.getCell(2).alignment = { horizontal: "right" };
    r.getCell(3).value = cat.expense_pct / 100;
    r.getCell(3).numFmt = PERCENT_FMT;
    r.getCell(3).alignment = { horizontal: "right" };
    const blocks = Math.round((cat.expense_pct / 100) * 16);
    r.getCell(4).value = "█".repeat(Math.max(0, blocks)) + "░".repeat(Math.max(0, 16 - blocks));
    r.getCell(4).font = { color: { argb: hexWithAlpha(cat.category_color, "FF") }, size: 9 };
    r.getCell(4).alignment = { horizontal: "left" };
    r.getCell(5).value = cat.transaction_count;
    r.getCell(5).alignment = { horizontal: "right" };
    row += 1;
  });
  bandRows(ws, start, row - 1, 5);

  // Total row.
  const totalExpense = data.by_category.reduce((s, c) => s + c.expense_minor, 0);
  const totalCount = data.by_category.reduce((s, c) => s + c.transaction_count, 0);
  const tr = ws.getRow(row);
  tr.getCell(1).value = "TOTAL";
  tr.getCell(1).font = { bold: true, color: { argb: THEME.ink } };
  tr.getCell(2).value = reportAmount(totalExpense);
  tr.getCell(2).numFmt = CURRENCY_FMT;
  tr.getCell(2).font = { bold: true };
  tr.getCell(2).alignment = { horizontal: "right" };
  tr.getCell(3).value = 1;
  tr.getCell(3).numFmt = PERCENT_FMT;
  tr.getCell(3).font = { bold: true };
  tr.getCell(3).alignment = { horizontal: "right" };
  tr.getCell(5).value = totalCount;
  tr.getCell(5).font = { bold: true };
  tr.getCell(5).alignment = { horizontal: "right" };
  for (let c = 1; c <= 5; c++) {
    tr.getCell(c).border = { top: { style: "thin", color: { argb: THEME.ink } } };
  }
  row += 1;

  return row + 2;
}

/**
 * Writes a single italic placeholder row across the given columns so a section
 * is not blank/confusing when there is no data for the period.
 */
function writeEmptyState(ws: ExcelJS.Worksheet, row: number, message: string, spanCols: number): void {
  ws.mergeCells(row, 1, row, spanCols);
  const cell = ws.getCell(row, 1);
  cell.value = message;
  cell.font = { italic: true, color: { argb: THEME.muted }, size: 11 };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
}

function writeMerchantSection(ws: ExcelJS.Worksheet, data: ReportData, row: number): number {
  const merchants = data.top_merchants.slice(0, 10);
  row = writeSectionBar(ws, row, "Top Merchant");
  writeTableHeader(ws, row, [
    { label: "#", align: "center" },
    { label: "Merchant" },
    { label: "Pengeluaran", align: "right" },
    { label: "Tx", align: "right" },
    { label: "Rata-rata/Tx", align: "right" }
  ]);
  row += 1;

  if (merchants.length === 0) {
    writeEmptyState(ws, row, "Belum ada merchant dengan pengeluaran pada periode ini.", 5);
    return row + 2;
  }

  const start = row;
  merchants.forEach((m, idx) => {
    const r = ws.getRow(row);
    r.height = 19;
    r.getCell(1).value = idx + 1;
    r.getCell(1).alignment = { horizontal: "center" };
    r.getCell(1).font = { bold: true, color: { argb: THEME.primary } };
    r.getCell(2).value = m.name;
    r.getCell(2).font = { bold: idx < 3, color: { argb: THEME.ink } };
    r.getCell(3).value = reportAmount(m.expense_minor);
    r.getCell(3).numFmt = CURRENCY_FMT;
    r.getCell(3).alignment = { horizontal: "right" };
    r.getCell(4).value = m.transaction_count;
    r.getCell(4).alignment = { horizontal: "right" };
    r.getCell(5).value = m.transaction_count > 0 ? reportAmount(m.expense_minor) / m.transaction_count : 0;
    r.getCell(5).numFmt = CURRENCY_FMT;
    r.getCell(5).alignment = { horizontal: "right" };
    row += 1;
  });
  bandRows(ws, start, row - 1, 5);

  return row + 2;
}

function writeTrendSection(ws: ExcelJS.Worksheet, data: ReportData, row: number): number {
  row = writeSectionBar(ws, row, "Tren 6 Bulan");
  writeTableHeader(ws, row, [
    { label: "Bulan" },
    { label: "Pemasukan", align: "right" },
    { label: "Pengeluaran", align: "right" },
    { label: "Net", align: "right" },
    { label: "vs Lalu", align: "center" }
  ]);
  row += 1;

  if (data.trend.length === 0) {
    writeEmptyState(ws, row, "Belum ada data tren.", 5);
    return row + 2;
  }

  const start = row;
  data.trend.forEach((t, idx) => {
    const r = ws.getRow(row);
    r.height = 19;
    const [y, m] = t.month.split("-").map(Number);
    r.getCell(1).value = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    r.getCell(2).value = reportAmount(t.income_minor);
    r.getCell(2).numFmt = CURRENCY_FMT;
    r.getCell(2).alignment = { horizontal: "right" };
    r.getCell(3).value = reportAmount(t.expense_minor);
    r.getCell(3).numFmt = CURRENCY_FMT;
    r.getCell(3).alignment = { horizontal: "right" };
    const net = t.income_minor - t.expense_minor;
    r.getCell(4).value = reportAmount(net);
    r.getCell(4).numFmt = CURRENCY_FMT;
    r.getCell(4).alignment = { horizontal: "right" };
    r.getCell(4).font = { bold: true, color: { argb: net >= 0 ? THEME.income : THEME.expense } };
    if (idx > 0) {
      const prev = data.trend[idx - 1];
      const deltaExp = t.expense_minor - prev.expense_minor;
      const pct = prev.expense_minor > 0 ? Math.round((deltaExp / prev.expense_minor) * 100) : 0;
      const arrow = deltaExp > 0 ? "▲" : deltaExp < 0 ? "▼" : "—";
      const d = r.getCell(5);
      d.value = `${arrow} ${Math.abs(pct)}%`;
      d.alignment = { horizontal: "center" };
      d.font = { bold: true, color: { argb: deltaExp > 0 ? THEME.expense : deltaExp < 0 ? THEME.income : THEME.muted } };
    } else {
      r.getCell(5).value = "—";
      r.getCell(5).alignment = { horizontal: "center" };
      r.getCell(5).font = { color: { argb: THEME.muted } };
    }
    row += 1;
  });
  bandRows(ws, start, row - 1, 5);

  // Averages row.
  const avgIncome = data.trend.reduce((s, t) => s + t.income_minor, 0) / data.trend.length;
  const avgExpense = data.trend.reduce((s, t) => s + t.expense_minor, 0) / data.trend.length;
  const ar = ws.getRow(row);
  ar.getCell(1).value = "RATA-RATA";
  ar.getCell(1).font = { bold: true, color: { argb: THEME.ink } };
  ar.getCell(2).value = reportAmount(avgIncome);
  ar.getCell(2).numFmt = CURRENCY_FMT;
  ar.getCell(2).font = { bold: true };
  ar.getCell(2).alignment = { horizontal: "right" };
  ar.getCell(3).value = reportAmount(avgExpense);
  ar.getCell(3).numFmt = CURRENCY_FMT;
  ar.getCell(3).font = { bold: true };
  ar.getCell(3).alignment = { horizontal: "right" };
  ar.getCell(4).value = reportAmount(avgIncome - avgExpense);
  ar.getCell(4).numFmt = CURRENCY_FMT;
  ar.getCell(4).font = { bold: true };
  ar.getCell(4).alignment = { horizontal: "right" };
  for (let c = 1; c <= 5; c++) {
    ar.getCell(c).border = { top: { style: "thin", color: { argb: THEME.ink } } };
  }
  row += 1;

  return row + 2;
}

function writeInsightSection(
  ws: ExcelJS.Worksheet,
  insight: ParsedReportInsight | null,
  options: { aiModelLabel: string | null },
  row: number
): number {
  const label = options.aiModelLabel ? `Analisis AI · ${options.aiModelLabel}` : "Analisis AI";
  row = writeSectionBar(ws, row, label);

  if (!insight) {
    writeEmptyState(ws, row, "Insight AI tidak tersedia untuk rentang ini.", 8);
    return row + 2;
  }

  const para = (text: string, font?: Partial<ExcelJS.Font>) => {
    ws.mergeCells(row, 1, row, 8);
    const cell = ws.getCell(row, 1);
    cell.value = text;
    cell.alignment = { vertical: "top", horizontal: "left", wrapText: true, indent: 1 };
    cell.font = { size: 11, color: { argb: THEME.ink }, ...(font ?? {}) };
    ws.getRow(row).height = 16 * Math.max(1, Math.ceil(text.length / 110));
    row += 1;
  };

  const subHeader = (text: string) => {
    ws.mergeCells(row, 1, row, 8);
    const cell = ws.getCell(row, 1);
    cell.value = text;
    cell.font = { bold: true, size: 12, color: { argb: THEME.primary } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(row).height = 20;
    row += 1;
  };

  const bullets = (items: string[], color: string) => {
    for (const item of items) {
      ws.mergeCells(row, 1, row, 8);
      const cell = ws.getCell(row, 1);
      cell.value = `●  ${item}`;
      cell.alignment = { vertical: "top", horizontal: "left", wrapText: true, indent: 1 };
      cell.font = { size: 11, color: { argb: color } };
      ws.getRow(row).height = Math.max(18, 16 * Math.ceil(item.length / 110));
      row += 1;
    }
  };

  subHeader("Ringkasan Eksekutif");
  para(insight.executive_summary);
  row += 1;

  if (insight.strengths.length > 0) {
    subHeader("Kekuatan");
    bullets(insight.strengths, THEME.income);
    row += 1;
  }
  if (insight.concerns.length > 0) {
    subHeader("Perhatian");
    bullets(insight.concerns, THEME.expense);
    row += 1;
  }
  if (insight.anomalies.length > 0) {
    subHeader("Anomali & Pola Mencurigakan");
    bullets(insight.anomalies, THEME.amber);
    row += 1;
  }
  if (insight.recommendations.length > 0) {
    subHeader("Rekomendasi");
    for (const rec of insight.recommendations) {
      para(`▸ ${rec.title}`, { bold: true, color: { argb: THEME.ink }, size: 12 });
      para(`   ${rec.rationale}`, { italic: true, color: { argb: THEME.muted } });
      if (typeof rec.potential_saving_minor === "number" && rec.potential_saving_minor > 0) {
        para(`   Potensi penghematan: ${formatCurrency(rec.potential_saving_minor, "IDR")}`, {
          bold: true,
          color: { argb: THEME.income }
        });
      }
      row += 1;
    }
  }
  if (insight.forecast) {
    subHeader("Proyeksi Periode Berikutnya");
    para(`Estimasi pengeluaran: ${formatCurrency(insight.forecast.next_period_expense_minor, "IDR")}`, {
      bold: true,
      color: { argb: THEME.expense }
    });
    para(`Tingkat keyakinan: ${Math.round(insight.forecast.confidence * 100)}%`, { bold: true });
    para(`Asumsi: ${insight.forecast.assumptions.join("; ")}`, { italic: true, color: { argb: THEME.muted } });
  }

  return row;
}

// ─── Sheet 2: Transactions ───────────────────────────────────────────────────

function buildTransactionsSheet(wb: ExcelJS.Workbook, data: ReportData): void {
  const ws = wb.addWorksheet("Transaksi", {
    properties: { tabColor: { argb: THEME.primaryDark } },
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }]
  });

  ws.columns = [
    { header: "Tanggal", width: 14 },
    { header: "Tipe", width: 12 },
    { header: "Merchant", width: 28 },
    { header: "Kategori", width: 20 },
    { header: "Metode", width: 16 },
    { header: "Nominal", width: 20 },
    { header: "Mata Uang", width: 12 }
  ];

  writeBanner(ws, "Daftar Transaksi", `${data.window.description} · ${data.transactions.length} transaksi`);

  const headerRowNum = 3;
  const headerRow = ws.getRow(headerRowNum);
  headerRow.height = 22;
  ws.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = String(col.header ?? "");
    cell.font = HEADER_FONT;
    cell.fill = solid(THEME.primary);
    cell.alignment = { vertical: "middle", horizontal: i === 5 ? "right" : "left", indent: 1 };
  });

  const startDataRow = 4;

  // category-id → name lookup from by_category (which already carries names).
  const categoryNameById = new Map<string, string>();
  for (const c of data.by_category) {
    if (c.category_id) categoryNameById.set(c.category_id, c.category_name);
  }

  if (data.transactions.length === 0) {
    writeEmptyState(ws, startDataRow, "Belum ada transaksi pada periode ini.", 7);
    return;
  }

  data.transactions.forEach((tx, idx) => {
    const r = ws.getRow(startDataRow + idx);
    const date = new Date(tx.occurred_at);
    r.getCell(1).value = date;
    r.getCell(1).numFmt = "dd/mm/yyyy";
    r.getCell(1).alignment = { horizontal: "left" };

    const typeColor =
      tx.transaction_type === "income" ? THEME.income :
      tx.transaction_type === "expense" ? THEME.expense :
      THEME.muted;
    const typeLabel =
      tx.transaction_type === "income" ? "Income" :
      tx.transaction_type === "expense" ? "Expense" :
      "Transfer";
    r.getCell(2).value = typeLabel;
    r.getCell(2).font = { bold: true, color: { argb: typeColor } };

    r.getCell(3).value = tx.merchant_name ?? "—";
    r.getCell(4).value = tx.category_id ? (categoryNameById.get(tx.category_id) ?? "Tanpa Kategori") : "Tanpa Kategori";
    r.getCell(5).value = tx.payment_method ?? "—";

    const signedAmount = tx.transaction_type === "expense" ? -Math.abs(tx.amount_minor) : Math.abs(tx.amount_minor);
    const amountCell = r.getCell(6);
    amountCell.value = amountMinorToMajor(signedAmount, tx.currency);
    amountCell.numFmt = excelCurrencyFormat(tx.currency);
    amountCell.alignment = { horizontal: "right" };
    amountCell.font = { bold: true, color: { argb: typeColor } };

    r.getCell(7).value = tx.currency;
    r.getCell(7).alignment = { horizontal: "center" };
    r.getCell(7).font = { bold: true, color: { argb: THEME.muted } };
  });

  const lastTxRow = startDataRow + data.transactions.length - 1;
  bandRows(ws, startDataRow, lastTxRow, 7);
  ws.autoFilter = {
    from: { row: headerRowNum, column: 1 },
    to: { row: lastTxRow, column: 7 }
  };
  autoFitColumns(ws, 7, 3, lastTxRow, { minWidth: 12, maxWidth: 40 });
}

export type ReportWorkbookInput = {
  data: ReportData;
  insight: ParsedReportInsight | null;
  userName: string | null;
  aiModelLabel: string | null;
};

export type ReportWindowType = ReportWindow;
