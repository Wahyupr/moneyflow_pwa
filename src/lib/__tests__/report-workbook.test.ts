import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { buildReportWorkbook } from "../excel/report-workbook";
import type { ReportData } from "../reports-data";
import type { ParsedReportInsight } from "../ai/report-insight";

function buildReportData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    window: {
      month: "2026-06",
      fromIso: "2026-06-01T00:00:00.000Z",
      toIso: "2026-07-01T00:00:00.000Z",
      isCustomRange: false,
      description: "Juni 2026"
    },
    totals: {
      income_minor: 8_500_000,
      expense_minor: 6_200_000,
      net_minor: 2_300_000,
      savings_rate_pct: 27,
      transaction_count: 42
    },
    previous_totals: {
      income_minor: 8_000_000,
      expense_minor: 5_800_000,
      net_minor: 2_200_000
    },
    by_category: [
      {
        category_id: "c1",
        category_name: "Makanan",
        category_color: "#FF6B35",
        expense_minor: 2_500_000,
        expense_pct: 40,
        transaction_count: 15
      }
    ],
    top_merchants: [
      { name: "GoFood", expense_minor: 1_800_000, transaction_count: 25 }
    ],
    trend: [
      { month: "2026-01", income_minor: 8_000_000, expense_minor: 5_500_000 },
      { month: "2026-02", income_minor: 8_200_000, expense_minor: 5_900_000 },
      { month: "2026-03", income_minor: 8_100_000, expense_minor: 5_800_000 },
      { month: "2026-04", income_minor: 8_300_000, expense_minor: 5_700_000 },
      { month: "2026-05", income_minor: 8_000_000, expense_minor: 5_800_000 },
      { month: "2026-06", income_minor: 8_500_000, expense_minor: 6_200_000 }
    ],
    transactions: [
      {
        id: "tx1",
        user_id: "u1",
        wallet_id: "w1",
        category_id: "c1",
        merchant_name: "GoFood",
        payment_method: "GoPay",
        transaction_type: "expense",
        amount_minor: 75_000,
        currency: "IDR",
        occurred_at: "2026-06-10T03:00:00.000Z",
        transfer_pair_id: null
      }
    ],
    generated_at: "2026-06-16T10:00:00Z",
    ...overrides
  };
}

const fallbackInsight: ParsedReportInsight = {
  executive_summary: "Bulan ini terkendali.",
  strengths: ["Tabungan 27%"],
  concerns: ["Makanan dominan"],
  anomalies: [],
  recommendations: [
    { title: "Tinjau GoFood", rationale: "Frekuensi tinggi", potential_saving_minor: 200_000 }
  ],
  forecast: {
    next_period_expense_minor: 6_100_000,
    confidence: 0.5,
    assumptions: ["Pola stabil"]
  }
};

async function loadWorkbook(buf: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  // ExcelJS type signature expects its own Buffer union; cast via Uint8Array
  // which is valid for the underlying loader implementation.
  await wb.xlsx.load(new Uint8Array(buf) as unknown as ExcelJS.Buffer);
  return wb;
}

describe("buildReportWorkbook", () => {
  it("emits 6 sheets with the expected names and order", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData(),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);

    const names = wb.worksheets.map((ws) => ws.name);
    expect(names).toEqual([
      "Ringkasan",
      "Kategori",
      "Merchant",
      "Tren 6 Bulan",
      "Transaksi",
      "AI Insight"
    ]);
  });

  it("uses a distinct tab color per sheet", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData(),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);

    const tabColors = wb.worksheets.map((ws) => {
      // ExcelJS exposes tab color via properties.tabColor; the value shape is
      // { argb: "FFF97316" } or similar. Normalise to upper-case string.
      const c = ws.properties?.tabColor as { argb?: string } | string | undefined;
      if (typeof c === "string") return c.toUpperCase();
      return (c?.argb ?? "").toUpperCase();
    });

    // All tabs should have a non-empty color.
    expect(tabColors.every((c) => c.length > 0)).toBe(true);
    // All colors should be distinct.
    expect(new Set(tabColors).size).toBe(tabColors.length);
  });

  it("writes the user name and period description in the Ringkasan banner", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData(),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const summary = wb.getWorksheet("Ringkasan")!;
    const bannerText = String(summary.getCell("A2").value ?? "");

    expect(bannerText).toContain("Juni 2026");
    expect(bannerText).toContain("Andi");
  });

  it("writes category rows with currency values on the Kategori sheet", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData(),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Kategori")!;

    // Header row is row 3; first data row is row 4.
    const headerCell = ws.getRow(3).getCell(1).value;
    expect(headerCell).toBe("Kategori");

    const firstDataRow = ws.getRow(4);
    expect(String(firstDataRow.getCell(1).value)).toBe("Makanan");
    // Expense in minor → divided by 100 to get rupiah major.
    expect(firstDataRow.getCell(2).value).toBe(25_000); // 2_500_000 / 100
    expect(firstDataRow.getCell(2).numFmt).toContain("Rp");
  });

  it("writes transactions with signed amounts (expense negative)", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData(),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Transaksi")!;

    const firstDataRow = ws.getRow(4);
    // Column 6 is the amount column. Expense 75_000 minor → -750 rupiah major.
    expect(firstDataRow.getCell(6).value).toBe(-750);
    expect(firstDataRow.getCell(6).numFmt).toContain("Red");
  });

  it("handles empty by_category gracefully (still emits the sheet)", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData({ by_category: [] }),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Kategori")!;
    expect(ws).toBeTruthy();
    // First data row should contain the empty-state message.
    expect(String(ws.getRow(4).getCell(1).value)).toMatch(/belum ada/i);
  });

  it("shows empty-state row when transactions list is empty", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData({ transactions: [] }),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Transaksi")!;
    expect(String(ws.getRow(4).getCell(1).value)).toMatch(/belum ada/i);
  });

  it("shows empty-state row when merchant list is empty", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData({ top_merchants: [] }),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Merchant")!;
    expect(String(ws.getRow(4).getCell(1).value)).toMatch(/belum ada/i);
  });

  it("emits AI Insight sheet even when insight is null", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData(),
      null,
      { userName: "Andi", aiModelLabel: null }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("AI Insight")!;
    expect(ws).toBeTruthy();
    // The unavailable note should appear somewhere on the sheet.
    const cellValues: string[] = [];
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === "string") cellValues.push(cell.value);
      });
    });
    expect(cellValues.some((v) => v.includes("tidak tersedia"))).toBe(true);
  });

  it("embeds executive summary and recommendations on AI Insight sheet", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData(),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("AI Insight")!;

    const cellValues: string[] = [];
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === "string") cellValues.push(cell.value);
      });
    });

    expect(cellValues.some((v) => v.includes("Bulan ini terkendali"))).toBe(true);
    expect(cellValues.some((v) => v.includes("Tinjau GoFood"))).toBe(true);
  });

  it("appends a totals row on the Kategori sheet", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData(),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Kategori")!;

    // 1 data row at row 4 → totals at row 5.
    const totalsRow = ws.getRow(5);
    expect(String(totalsRow.getCell(1).value)).toBe("TOTAL");
    expect(totalsRow.getCell(2).value).toBe(25_000); // 2_500_000 / 100
    expect(totalsRow.getCell(4).value).toBe(15);
  });

  it("appends a totals row on the Merchant sheet with computed average", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData(),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Merchant")!;

    const totalsRow = ws.getRow(5);
    expect(String(totalsRow.getCell(2).value)).toBe("TOTAL");
    expect(totalsRow.getCell(3).value).toBe(18_000); // 1_800_000 / 100
    expect(totalsRow.getCell(4).value).toBe(25);
    // 1_800_000 minor / 25 tx = 72_000 minor per tx → 720 rupiah.
    expect(totalsRow.getCell(5).value).toBe(720);
  });

  it("appends a 6-month averages row on the Tren sheet", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData(),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Tren 6 Bulan")!;

    // 6 data rows (rows 4–9), averages at row 10.
    const avgRow = ws.getRow(10);
    expect(String(avgRow.getCell(1).value)).toBe("RATA-RATA");
    // Average income: (8M+8.2M+8.1M+8.3M+8M+8.5M) / 6 = 8.183M minor / 100 = 81_833.33
    expect(Number(avgRow.getCell(2).value)).toBeCloseTo(81_833.33, -1);
  });

  it("applies auto-fit column widths within sensible bounds", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData(),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Transaksi")!;

    // Column widths must be within the [12, 40] bounds passed to autoFitColumns.
    for (let c = 1; c <= 6; c++) {
      const width = ws.getColumn(c).width ?? 0;
      expect(width).toBeGreaterThanOrEqual(10);
      expect(width).toBeLessThanOrEqual(45);
    }
  });
});
