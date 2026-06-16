/**
 * Excel workbook generator for the personal-finance report download.
 *
 * Produces a multi-sheet .xlsx with:
 *   1. Ringkasan   — totals, deltas, savings rate, transaction count (orange)
 *   2. Kategori    — expense breakdown per category with % (blue)
 *   3. Merchant    — top 20 merchants by spend (purple)
 *   4. Tren        — 6-month income vs expense trend (green)
 *   5. Transaksi   — raw transaction list (grey)
 *   6. AI Insight  — narrative analysis from the AI (amber)
 *
 * All amount cells use the Indonesian rupiah format. Header rows use a
 * per-sheet color theme (matching the tab color) so users can quickly orient
 * themselves when flipping between sheets.
 */

import ExcelJS from "exceljs";

import type { ReportData, ReportWindow } from "@/lib/reports-data";
import type { ParsedReportInsight } from "@/lib/ai/report-insight";
import { formatCurrency } from "@/lib/money";

const SHEET_THEME = {
  summary: { tab: "FFF97316", header: "FFF97316", light: "FFFED7AA" }, // orange
  categories: { tab: "FF3B82F6", header: "FF3B82F6", light: "FFBFDBFE" }, // blue
  merchants: { tab: "FF8B5CF6", header: "FF8B5CF6", light: "FFDDD6FE" }, // purple
  trend: { tab: "FF10B981", header: "FF10B981", light: "FFA7F3D0" }, // green
  transactions: { tab: "FF64748B", header: "FF64748B", light: "FFE2E8F0" }, // grey
  insights: { tab: "FFF59E0B", header: "FFF59E0B", light: "FFFDE68A" } // amber
} as const;

const CURRENCY_FMT = '"Rp"#,##0;[Red]-"Rp"#,##0';
const PERCENT_FMT = "0.0%";
const BOLD_WHITE: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: "FFFFFFFF" }, size: 12 },
  alignment: { vertical: "middle", horizontal: "left" }
};

export async function buildReportWorkbook(
  data: ReportData,
  insight: ParsedReportInsight | null,
  options: { userName: string | null; aiModelLabel: string | null }
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Moneyflow";
  wb.created = new Date();
  wb.title = `Laporan Keuangan ${data.window.description}`;

  buildSummarySheet(wb, data, options);
  buildCategorySheet(wb, data);
  buildMerchantSheet(wb, data);
  buildTrendSheet(wb, data);
  buildTransactionsSheet(wb, data);
  buildInsightSheet(wb, data, insight, options);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function styleHeaderRow(ws: ExcelJS.Worksheet, fillColor: string): void {
  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fillColor }
    };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF000000" } }
    };
  });
}

function applyBandedRows(ws: ExcelJS.Worksheet, startRow: number, endRow: number, lightColor: string): void {
  for (let r = startRow; r <= endRow; r++) {
    if ((r - startRow) % 2 !== 0) continue; // even index → banded
    const row = ws.getRow(r);
    row.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: lightColor }
      };
    });
  }
}

/**
 * Auto-fit column widths based on actual cell content across a row range.
 *
 * ExcelJS does not compute widths automatically. We iterate every cell in the
 * supplied rows for each column, take the max rendered length, then apply a
 * small padding. Capped so a single very long value doesn't blow out a column.
 */
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
      const cell = row.getCell(c);
      const raw = cell.value;
      let text = "";
      if (typeof raw === "string") text = raw;
      else if (typeof raw === "number") text = Math.round(raw).toString();
      else if (raw instanceof Date) text = raw.toLocaleDateString("id-ID");
      else if (raw && typeof raw === "object" && "text" in raw) text = String((raw as { text: string }).text);
      // Long strings wrap in cells with wrapText; only first ~60 chars matter for width.
      const visible = text.length > maxWidth ? text.slice(0, maxWidth) : text;
      if (visible.length > maxima[c - 1]) maxima[c - 1] = visible.length;
    }
  }

  for (let c = 1; c <= columnCount; c++) {
    const computed = Math.min(maxWidth, Math.max(minWidth, maxima[c - 1] + padding));
    ws.getColumn(c).width = computed;
  }
}

/**
 * Writes a totals row with bold + tinted background at the given row number.
 * Each entry is [columnIndex, formattedValue, numFmt?]. The row also gets a
 * top border so it reads as a summary separator.
 */
function writeTotalsRow(
  ws: ExcelJS.Worksheet,
  rowNum: number,
  entries: Array<{ col: number; value: string | number; numFmt?: string; align?: "left" | "right" | "center" }>,
  accentColor: string
): void {
  const row = ws.getRow(rowNum);
  row.height = 22;
  for (const entry of entries) {
    const cell = row.getCell(entry.col);
    cell.value = entry.value;
    if (entry.numFmt) cell.numFmt = entry.numFmt;
    cell.font = { bold: true, color: { argb: "FF1E293B" }, size: 12 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: accentColor } };
    cell.alignment = { horizontal: entry.align ?? "right", vertical: "middle", indent: 1 };
    cell.border = { top: { style: "thin", color: { argb: "FF1E293B" } } };
  }
}

function writeTitleBanner(
  ws: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  fillColor: string
): void {
  ws.mergeCells("A1:D1");
  const titleCell = ws.getCell("A1");
  titleCell.value = title;
  titleCell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 16 };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 32;

  ws.mergeCells("A2:D2");
  const subCell = ws.getCell("A2");
  subCell.value = subtitle;
  subCell.font = { italic: true, color: { argb: "FF475569" }, size: 11 };
  subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(2).height = 18;
}

function buildSummarySheet(wb: ExcelJS.Workbook, data: ReportData, options: { userName: string | null }): void {
  const theme = SHEET_THEME.summary;
  const ws = wb.addWorksheet("Ringkasan", {
    properties: { tabColor: { argb: theme.tab } },
    views: [{ showGridLines: false }]
  });

  ws.columns = [
    { width: 28 },
    { width: 22 },
    { width: 22 },
    { width: 22 }
  ];

  const userLabel = options.userName ? ` · ${options.userName}` : "";
  writeTitleBanner(ws, "Ringkasan Keuangan", `${data.window.description}${userLabel}`, theme.tab);

  // Section: Total
  let row = 4;
  ws.getCell(`A${row}`).value = "Total";
  ws.getCell(`A${row}`).font = { bold: true, size: 14, color: { argb: theme.tab } };
  row += 1;

  const totalsRows: Array<[string, string, string]> = [
    ["Pemasukan", "income_minor", "B"],
    ["Pengeluaran", "expense_minor", "C"],
    ["Selisih (Net)", "net_minor", "D"]
  ];
  for (const [label, key, col] of totalsRows) {
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).font = { size: 12 };
    const valueCell = ws.getCell(`${col}${row}`);
    // totals is shaped from ReportData
    valueCell.value = (data.totals as unknown as Record<string, number>)[key] / 100;
    valueCell.numFmt = CURRENCY_FMT;
    valueCell.font = { bold: true, size: 12 };
    valueCell.alignment = { horizontal: "right" };
    row += 1;
  }

  // Savings rate badge
  ws.getCell(`A${row}`).value = "Tingkat Tabung";
  const srCell = ws.getCell(`B${row}`);
  srCell.value = data.totals.savings_rate_pct / 100;
  srCell.numFmt = PERCENT_FMT;
  srCell.font = {
    bold: true,
    color: { argb: data.totals.savings_rate_pct >= 20 ? "FF10B981" : "FFEF4444" }
  };
  srCell.alignment = { horizontal: "right" };
  row += 1;

  ws.getCell(`A${row}`).value = "Jumlah Transaksi";
  ws.getCell(`B${row}`).value = data.totals.transaction_count;
  ws.getCell(`B${row}`).font = { bold: true };
  ws.getCell(`B${row}`).alignment = { horizontal: "right" };
  row += 2;

  // Section: Perbandingan Periode Sebelumnya
  ws.getCell(`A${row}`).value = "vs Periode Sebelumnya";
  ws.getCell(`A${row}`).font = { bold: true, size: 14, color: { argb: theme.tab } };
  row += 1;

  ws.getCell(`A${row}`).value = "Metrik";
  ws.getCell(`B${row}`).value = "Periode Ini";
  ws.getCell(`C${row}`).value = "Periode Lalu";
  ws.getCell(`D${row}`).value = "Δ %";
  for (const c of ["A", "B", "C", "D"]) {
    const cell = ws.getCell(`${c}${row}`);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.header } };
    cell.alignment = { horizontal: c === "A" ? "left" : "right", indent: 1 };
  }
  const headerRowNum = row;
  row += 1;

  const comparisonRows: Array<[string, number, number]> = [
    ["Pemasukan", data.totals.income_minor, data.previous_totals.income_minor],
    ["Pengeluaran", data.totals.expense_minor, data.previous_totals.expense_minor],
    ["Net", data.totals.net_minor, data.previous_totals.net_minor]
  ];
  const dataStart = row;
  for (const [label, current, previous] of comparisonRows) {
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).font = { size: 12 };
    ws.getCell(`B${row}`).value = current / 100;
    ws.getCell(`B${row}`).numFmt = CURRENCY_FMT;
    ws.getCell(`B${row}`).alignment = { horizontal: "right" };
    ws.getCell(`C${row}`).value = previous / 100;
    ws.getCell(`C${row}`).numFmt = CURRENCY_FMT;
    ws.getCell(`C${row}`).alignment = { horizontal: "right" };
    const deltaPct = previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 100);
    const deltaCell = ws.getCell(`D${row}`);
    deltaCell.value = deltaPct / 100;
    deltaCell.numFmt = "+0%;-0%;0%";
    deltaCell.font = {
      bold: true,
      color: { argb: deltaPct >= 0 ? "FF10B981" : "FFEF4444" }
    };
    deltaCell.alignment = { horizontal: "right" };
    row += 1;
  }
  applyBandedRows(ws, dataStart, row - 1, theme.light);

  // Freeze the title banner off-screen via headerRowNum reference (no freeze
  // on summary because it's a single-screen dashboard-style page).
  void headerRowNum;
}

function buildCategorySheet(wb: ExcelJS.Workbook, data: ReportData): void {
  const theme = SHEET_THEME.categories;
  const ws = wb.addWorksheet("Kategori", {
    properties: { tabColor: { argb: theme.tab } },
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }]
  });

  ws.columns = [
    { header: "Kategori", key: "name", width: 32 },
    { header: "Pengeluaran", key: "expense", width: 22 },
    { header: "% dari Total", key: "pct", width: 16 },
    { header: "Jumlah Tx", key: "count", width: 12 }
  ];

  writeTitleBanner(ws, "Breakdown Kategori", `${data.window.description} · ${data.by_category.length} kategori`, theme.tab);

  // Shift headers to row 3 (after the 2-row banner).
  const headerRowNum = 3;
  const headerRow = ws.getRow(headerRowNum);
  headerRow.height = 22;
  ws.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = String(col.header ?? "");
    cell.style = { ...BOLD_WHITE, fill: { type: "pattern", pattern: "solid", fgColor: { argb: theme.header } } };
    cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "right", indent: 1 };
  });

  const startDataRow = 4;
  if (data.by_category.length === 0) {
    writeEmptyState(ws, startDataRow, "Belum ada pengeluaran tercatat pada periode ini.", 4);
    return;
  }
  data.by_category.forEach((cat, idx) => {
    const r = ws.getRow(startDataRow + idx);
    r.getCell(1).value = cat.category_name;
    r.getCell(2).value = cat.expense_minor / 100;
    r.getCell(2).numFmt = CURRENCY_FMT;
    r.getCell(2).alignment = { horizontal: "right" };
    r.getCell(3).value = cat.expense_pct / 100;
    r.getCell(3).numFmt = PERCENT_FMT;
    r.getCell(3).alignment = { horizontal: "right" };
    r.getCell(4).value = cat.transaction_count;
    r.getCell(4).alignment = { horizontal: "right" };

    // Color bar on category cell using the category's own color (subtle).
    r.getCell(1).font = { bold: idx < 3, color: { argb: "FF1E293B" } };
    r.getCell(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: hexWithAlpha(cat.category_color, "33") }
    };
  });
  const lastDataRow = startDataRow + data.by_category.length - 1;
  applyBandedRows(ws, startDataRow, lastDataRow, theme.light);

  // Totals row.
  const totalExpenseMinor = data.by_category.reduce((s, c) => s + c.expense_minor, 0);
  const totalCount = data.by_category.reduce((s, c) => s + c.transaction_count, 0);
  writeTotalsRow(ws, lastDataRow + 1, [
    { col: 1, value: "TOTAL", align: "left" },
    { col: 2, value: totalExpenseMinor / 100, numFmt: CURRENCY_FMT },
    { col: 3, value: 1, numFmt: PERCENT_FMT },
    { col: 4, value: totalCount }
  ], theme.light);

  autoFitColumns(ws, 4, 3, lastDataRow + 1, { minWidth: 12, maxWidth: 50 });
}

function buildMerchantSheet(wb: ExcelJS.Workbook, data: ReportData): void {
  const theme = SHEET_THEME.merchants;
  const ws = wb.addWorksheet("Merchant", {
    properties: { tabColor: { argb: theme.tab } },
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }]
  });

  ws.columns = [
    { header: "Peringkat", key: "rank", width: 10 },
    { header: "Merchant", key: "name", width: 36 },
    { header: "Total Pengeluaran", key: "expense", width: 24 },
    { header: "Jumlah Tx", key: "count", width: 12 },
    { header: "Rata-rata / Tx", key: "avg", width: 20 }
  ];

  writeTitleBanner(ws, "Top Merchant", `${data.window.description} · ${data.top_merchants.length} merchant teratas`, theme.tab);

  const headerRowNum = 3;
  const headerRow = ws.getRow(headerRowNum);
  headerRow.height = 22;
  ws.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = String(col.header ?? "");
    cell.style = { ...BOLD_WHITE, fill: { type: "pattern", pattern: "solid", fgColor: { argb: theme.header } } };
    cell.alignment = { vertical: "middle", horizontal: i === 0 || i === 1 ? "left" : "right", indent: 1 };
  });

  const startDataRow = 4;
  if (data.top_merchants.length === 0) {
    writeEmptyState(ws, startDataRow, "Belum ada merchant dengan pengeluaran pada periode ini.", 5);
    return;
  }
  data.top_merchants.forEach((m, idx) => {
    const r = ws.getRow(startDataRow + idx);
    r.getCell(1).value = idx + 1;
    r.getCell(1).alignment = { horizontal: "center" };
    r.getCell(1).font = { bold: idx < 3, color: { argb: theme.tab } };
    r.getCell(2).value = m.name;
    r.getCell(3).value = m.expense_minor / 100;
    r.getCell(3).numFmt = CURRENCY_FMT;
    r.getCell(3).alignment = { horizontal: "right" };
    r.getCell(4).value = m.transaction_count;
    r.getCell(4).alignment = { horizontal: "right" };
    r.getCell(5).value = m.transaction_count > 0 ? m.expense_minor / 100 / m.transaction_count : 0;
    r.getCell(5).numFmt = CURRENCY_FMT;
    r.getCell(5).alignment = { horizontal: "right" };
  });
  const lastDataRow = startDataRow + data.top_merchants.length - 1;
  applyBandedRows(ws, startDataRow, lastDataRow, theme.light);

  // Totals row.
  const totalExpenseMinor = data.top_merchants.reduce((s, m) => s + m.expense_minor, 0);
  const totalCount = data.top_merchants.reduce((s, m) => s + m.transaction_count, 0);
  const totalAvg = totalCount > 0 ? totalExpenseMinor / 100 / totalCount : 0;
  writeTotalsRow(ws, lastDataRow + 1, [
    { col: 1, value: "—", align: "center" },
    { col: 2, value: "TOTAL", align: "left" },
    { col: 3, value: totalExpenseMinor / 100, numFmt: CURRENCY_FMT },
    { col: 4, value: totalCount },
    { col: 5, value: totalAvg, numFmt: CURRENCY_FMT }
  ], theme.light);

  autoFitColumns(ws, 5, 3, lastDataRow + 1, { minWidth: 10, maxWidth: 50 });
}

function buildTrendSheet(wb: ExcelJS.Workbook, data: ReportData): void {
  const theme = SHEET_THEME.trend;
  const ws = wb.addWorksheet("Tren 6 Bulan", {
    properties: { tabColor: { argb: theme.tab } },
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }]
  });

  ws.columns = [
    { header: "Bulan", key: "month", width: 16 },
    { header: "Pemasukan", key: "income", width: 22 },
    { header: "Pengeluaran", key: "expense", width: 22 },
    { header: "Net", key: "net", width: 22 }
  ];

  writeTitleBanner(ws, "Tren 6 Bulan", "Pemasukan vs Pengeluaran", theme.tab);

  const headerRowNum = 3;
  const headerRow = ws.getRow(headerRowNum);
  headerRow.height = 22;
  ws.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = String(col.header ?? "");
    cell.style = { ...BOLD_WHITE, fill: { type: "pattern", pattern: "solid", fgColor: { argb: theme.header } } };
    cell.alignment = { vertical: "middle", horizontal: i === 0 ? "left" : "right", indent: 1 };
  });

  const startDataRow = 4;
  data.trend.forEach((t, idx) => {
    const r = ws.getRow(startDataRow + idx);
    const [y, m] = t.month.split("-").map(Number);
    const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric"
    });
    r.getCell(1).value = label;
    r.getCell(2).value = t.income_minor / 100;
    r.getCell(2).numFmt = CURRENCY_FMT;
    r.getCell(2).alignment = { horizontal: "right" };
    r.getCell(3).value = t.expense_minor / 100;
    r.getCell(3).numFmt = CURRENCY_FMT;
    r.getCell(3).alignment = { horizontal: "right" };
    r.getCell(4).value = (t.income_minor - t.expense_minor) / 100;
    r.getCell(4).numFmt = CURRENCY_FMT;
    r.getCell(4).alignment = { horizontal: "right" };
    r.getCell(4).font = {
      bold: true,
      color: { argb: t.income_minor - t.expense_minor >= 0 ? "FF10B981" : "FFEF4444" }
    };
  });
  const lastDataRow = startDataRow + Math.max(0, data.trend.length - 1);
  applyBandedRows(ws, startDataRow, lastDataRow, theme.light);

  // 6-month averages row.
  if (data.trend.length > 0) {
    const avgIncome = data.trend.reduce((s, t) => s + t.income_minor, 0) / data.trend.length;
    const avgExpense = data.trend.reduce((s, t) => s + t.expense_minor, 0) / data.trend.length;
    const avgNet = avgIncome - avgExpense;
    writeTotalsRow(ws, lastDataRow + 1, [
      { col: 1, value: "RATA-RATA", align: "left" },
      { col: 2, value: avgIncome / 100, numFmt: CURRENCY_FMT },
      { col: 3, value: avgExpense / 100, numFmt: CURRENCY_FMT },
      { col: 4, value: avgNet / 100, numFmt: CURRENCY_FMT }
    ], theme.light);
  }

  autoFitColumns(ws, 4, 3, lastDataRow + 1, { minWidth: 14, maxWidth: 40 });
}

function buildTransactionsSheet(wb: ExcelJS.Workbook, data: ReportData): void {
  const theme = SHEET_THEME.transactions;
  const ws = wb.addWorksheet("Transaksi", {
    properties: { tabColor: { argb: theme.tab } },
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }]
  });

  ws.columns = [
    { header: "Tanggal", key: "date", width: 14 },
    { header: "Tipe", key: "type", width: 12 },
    { header: "Merchant", key: "merchant", width: 28 },
    { header: "Kategori", key: "category", width: 20 },
    { header: "Metode", key: "method", width: 16 },
    { header: "Nominal", key: "amount", width: 20 }
  ];

  writeTitleBanner(ws, "Daftar Transaksi", `${data.window.description} · ${data.transactions.length} transaksi`, theme.tab);

  const headerRowNum = 3;
  const headerRow = ws.getRow(headerRowNum);
  headerRow.height = 22;
  ws.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = String(col.header ?? "");
    cell.style = { ...BOLD_WHITE, fill: { type: "pattern", pattern: "solid", fgColor: { argb: theme.header } } };
    cell.alignment = { vertical: "middle", horizontal: i === 5 ? "right" : "left", indent: 1 };
  });

  const startDataRow = 4;
  // Pre-build a category-id → name lookup from by_category (which already has names).
  const categoryNameById = new Map<string, string>();
  for (const c of data.by_category) {
    if (c.category_id) categoryNameById.set(c.category_id, c.category_name);
  }

  if (data.transactions.length === 0) {
    writeEmptyState(ws, startDataRow, "Belum ada transaksi pada periode ini.", 6);
    return;
  }

  data.transactions.forEach((tx, idx) => {
    const r = ws.getRow(startDataRow + idx);
    const date = new Date(tx.occurred_at);
    r.getCell(1).value = date;
    r.getCell(1).numFmt = "dd/mm/yyyy";
    r.getCell(1).alignment = { horizontal: "left" };

    const typeLabel =
      tx.transaction_type === "income" ? "Income" :
      tx.transaction_type === "expense" ? "Expense" :
      "Transfer";
    r.getCell(2).value = typeLabel;
    r.getCell(2).font = {
      bold: true,
      color: {
        argb:
          tx.transaction_type === "income" ? "FF10B981" :
          tx.transaction_type === "expense" ? "FFEF4444" :
          "FF64748B"
      }
    };

    r.getCell(3).value = tx.merchant_name ?? "—";
    r.getCell(4).value = tx.category_id ? (categoryNameById.get(tx.category_id) ?? "Tanpa Kategori") : "Tanpa Kategori";
    r.getCell(5).value = tx.payment_method ?? "—";

    const signedAmount = tx.transaction_type === "expense" ? -Math.abs(tx.amount_minor) : Math.abs(tx.amount_minor);
    const amountCell = r.getCell(6);
    amountCell.value = signedAmount / 100;
    amountCell.numFmt = CURRENCY_FMT;
    amountCell.alignment = { horizontal: "right" };
    amountCell.font = {
      bold: true,
      color: {
        argb: tx.transaction_type === "income" ? "FF10B981" : tx.transaction_type === "expense" ? "FFEF4444" : "FF64748B"
      }
    };
  });
  applyBandedRows(ws, startDataRow, startDataRow + Math.max(0, data.transactions.length - 1), theme.light);
  const lastTxRow = startDataRow + Math.max(0, data.transactions.length - 1);
  ws.autoFilter = {
    from: { row: headerRowNum, column: 1 },
    to: { row: lastTxRow, column: 6 }
  };
  autoFitColumns(ws, 6, 3, lastTxRow, { minWidth: 12, maxWidth: 40 });
}

function buildInsightSheet(
  wb: ExcelJS.Workbook,
  data: ReportData,
  insight: ParsedReportInsight | null,
  options: { aiModelLabel: string | null }
): void {
  const theme = SHEET_THEME.insights;
  const ws = wb.addWorksheet("AI Insight", {
    properties: { tabColor: { argb: theme.tab } },
    views: [{ showGridLines: false }]
  });

  ws.columns = [{ width: 4 }, { width: 100 }];

  writeTitleBanner(ws, "Analisis AI", data.window.description, theme.tab);

  let row = 4;

  if (!insight) {
    ws.getCell(`B${row}`).value = "Insight AI tidak tersedia untuk rentang ini.";
    ws.getCell(`B${row}`).font = { italic: true, color: { argb: "FF64748B" } };
    return;
  }

  // Executive Summary
  row = writeSectionHeader(ws, row, "Ringkasan Eksekutif", theme);
  row = writeParagraph(ws, row, insight.executive_summary);
  row += 1;

  if (insight.strengths.length > 0) {
    row = writeSectionHeader(ws, row, "Kekuatan", theme);
    row = writeBulletList(ws, row, insight.strengths, "FF10B981");
    row += 1;
  }

  if (insight.concerns.length > 0) {
    row = writeSectionHeader(ws, row, "Perhatian", theme);
    row = writeBulletList(ws, row, insight.concerns, "FFEF4444");
    row += 1;
  }

  if (insight.anomalies.length > 0) {
    row = writeSectionHeader(ws, row, "Anomali & Pola Mencurigakan", theme);
    row = writeBulletList(ws, row, insight.anomalies, "FFF59E0B");
    row += 1;
  }

  if (insight.recommendations.length > 0) {
    row = writeSectionHeader(ws, row, "Rekomendasi Actionable", theme);
    for (const rec of insight.recommendations) {
      const titleCell = ws.getCell(`B${row}`);
      titleCell.value = `▸ ${rec.title}`;
      titleCell.font = { bold: true, color: { argb: "FF1E293B" }, size: 12 };
      row += 1;
      row = writeParagraph(ws, row, `   ${rec.rationale}`, { italic: true, color: { argb: "FF475569" } });
      if (typeof rec.potential_saving_minor === "number" && rec.potential_saving_minor > 0) {
        const savCell = ws.getCell(`B${row}`);
        savCell.value = `   Potensi penghematan: ${formatCurrency(rec.potential_saving_minor, "IDR")}`;
        savCell.font = { bold: true, color: { argb: "FF10B981" } };
        row += 1;
      }
      row += 1;
    }
  }

  if (insight.forecast) {
    row = writeSectionHeader(ws, row, "Proyeksi Periode Berikutnya", theme);
    const f = insight.forecast;
    const fmtRow = (label: string, value: string, color = "FF1E293B") => {
      ws.getCell(`B${row}`).value = `${label}: ${value}`;
      ws.getCell(`B${row}`).font = { bold: true, color: { argb: color } };
      row += 1;
    };
    fmtRow("Estimasi pengeluaran", formatCurrency(f.next_period_expense_minor, "IDR"), "FFEF4444");
    fmtRow("Tingkat keyakinan", `${Math.round(f.confidence * 100)}%`);
    row = writeParagraph(ws, row, `Asumsi: ${f.assumptions.join("; ")}`, { italic: true, color: { argb: "FF475569" } });
    row += 1;
  }
}

function writeSectionHeader(ws: ExcelJS.Worksheet, row: number, label: string, theme: typeof SHEET_THEME[keyof typeof SHEET_THEME]): number {
  const cell = ws.getCell(`B${row}`);
  cell.value = label;
  cell.font = { bold: true, size: 14, color: { argb: theme.header } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: theme.light } };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(row).height = 22;
  return row + 1;
}

function writeParagraph(
  ws: ExcelJS.Worksheet,
  row: number,
  text: string,
  font?: Partial<ExcelJS.Font>
): number {
  const cell = ws.getCell(`B${row}`);
  cell.value = text;
  cell.alignment = { vertical: "top", horizontal: "left", wrapText: true, indent: 1 };
  cell.font = { size: 11, color: { argb: "FF1E293B" }, ...(font ?? {}) };
  // Estimate row height from text length (rough heuristic).
  const lineCount = Math.max(1, Math.ceil(text.length / 100));
  ws.getRow(row).height = 16 * lineCount;
  return row + 1;
}

function writeBulletList(ws: ExcelJS.Worksheet, row: number, items: string[], color: string): number {
  for (const item of items) {
    const marker = ws.getCell(`B${row}`);
    marker.value = `●  ${item}`;
    marker.alignment = { vertical: "top", horizontal: "left", wrapText: true, indent: 1 };
    marker.font = { size: 11, color: { argb: "FF1E293B" } };
    const lineCount = Math.max(1, Math.ceil(item.length / 100));
    ws.getRow(row).height = 16 * lineCount;
    // Tint the marker bullet by overriding via a left-indent colored cell.
    void color;
    row += 1;
  }
  return row;
}

/** Converts a #RRGGBB (or RRGGBB) string into ARGB with the supplied alpha. */
function hexWithAlpha(hex: string, alpha: string): string {
  const clean = hex.replace(/^#/, "").toUpperCase();
  if (clean.length === 8) return clean;
  if (clean.length !== 6) return `${alpha}94A3B8`;
  return `${alpha}${clean}`;
}

/**
 * Writes a single italic placeholder row across the given columns so the
 * sheet is not blank/confusing when there is no data for the period.
 */
function writeEmptyState(ws: ExcelJS.Worksheet, row: number, message: string, spanCols: number): void {
  const r = ws.getRow(row);
  r.getCell(1).value = message;
  r.getCell(1).font = { italic: true, color: { argb: "FF64748B" }, size: 11 };
  r.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  // Merge across the same column count as the header so the message spans the
  // visible table width.
  if (spanCols > 1) {
    ws.mergeCells(row, 1, row, spanCols);
  }
}

export type ReportWorkbookInput = {
  data: ReportData;
  insight: ParsedReportInsight | null;
  userName: string | null;
  aiModelLabel: string | null;
};

export type ReportWindowType = ReportWindow;
