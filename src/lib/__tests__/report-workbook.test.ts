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
  it("emits 2 sheets with the expected names and order", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData(),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);

    const names = wb.worksheets.map((ws) => ws.name);
    expect(names).toEqual(["Laporan", "Transaksi"]);
  });

  function collectStrings(ws: ExcelJS.Worksheet): string[] {
    const out: string[] = [];
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === "string") out.push(cell.value);
      });
    });
    return out;
  }


  it("uses a restrained workbook palette instead of rainbow sheet colors", async () => {
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

    expect(tabColors.every((c) => c.length > 0)).toBe(true);
    expect(new Set(tabColors).size).toBeLessThanOrEqual(2);
    expect(tabColors).not.toContain("FFF97316");
    expect(tabColors).not.toContain("FF8B5CF6");
  });

  it("writes the user name and period description in the Laporan banner", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData(),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const summary = wb.getWorksheet("Laporan")!;
    const bannerText = String(summary.getCell("A2").value ?? "");

    expect(bannerText).toContain("Juni 2026");
    expect(bannerText).toContain("Andi");
  });

  it("writes category rows with currency values on the Laporan sheet", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData(),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Laporan")!;

    // The category name and its currency-formatted amount both appear somewhere
    // in the combined dashboard sheet.
    let found = false;
    ws.eachRow((row) => {
      if (String(row.getCell(1).value) === "Makanan" && row.getCell(2).value === 2_500_000) {
        expect(row.getCell(2).numFmt).toContain("Rp");
        found = true;
      }
    });
    expect(found).toBe(true);
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
    // Column 6 is the amount column. IDR is stored as whole rupiah.
    expect(firstDataRow.getCell(6).value).toBe(-75_000);
    expect(firstDataRow.getCell(6).numFmt).toContain("Red");
    expect(firstDataRow.getCell(7).value).toBe("IDR");
  });

  it("writes each transaction amount using its own currency fraction digits", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData({
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
          },
          {
            id: "tx2",
            user_id: "u1",
            wallet_id: "w1",
            category_id: null,
            merchant_name: "Stripe",
            payment_method: "Card",
            transaction_type: "expense",
            amount_minor: 12_345,
            currency: "USD",
            occurred_at: "2026-06-11T03:00:00.000Z",
            transfer_pair_id: null
          }
        ]
      }),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Transaksi")!;

    expect(ws.getRow(3).getCell(7).value).toBe("Mata Uang");
    expect(ws.getRow(4).getCell(6).value).toBe(-75_000);

    expect(ws.getRow(4).getCell(7).value).toBe("IDR");
    expect(ws.getRow(5).getCell(6).value).toBe(-123.45);
    expect(ws.getRow(5).getCell(7).value).toBe("USD");
  });

  it("handles empty by_category gracefully (still emits the dashboard)", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData({ by_category: [] }),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Laporan")!;
    expect(ws).toBeTruthy();
    expect(collectStrings(ws).some((v) => /belum ada pengeluaran/i.test(v))).toBe(true);
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

  it("shows empty-state text when merchant list is empty (dashboard)", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData({ top_merchants: [] }),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Laporan")!;
    expect(collectStrings(ws).some((v) => /belum ada merchant/i.test(v))).toBe(true);
  });

  it("shows the unavailable AI note on the dashboard when insight is null", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData(),
      null,
      { userName: "Andi", aiModelLabel: null }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Laporan")!;
    expect(collectStrings(ws).some((v) => v.includes("tidak tersedia"))).toBe(true);
  });

  it("embeds executive summary and recommendations on the dashboard", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData(),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Laporan")!;
    const cellValues = collectStrings(ws);

    expect(cellValues.some((v) => v.includes("Bulan ini terkendali"))).toBe(true);
    expect(cellValues.some((v) => v.includes("Tinjau GoFood"))).toBe(true);
  });

  it("appends a category TOTAL row on the dashboard", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData(),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Laporan")!;

    let totalRow: ExcelJS.Row | null = null;
    ws.eachRow((row) => {
      if (String(row.getCell(1).value) === "TOTAL") totalRow = row;
    });
    expect(totalRow).not.toBeNull();
    expect(totalRow!.getCell(2).value).toBe(2_500_000);
    expect(totalRow!.getCell(5).value).toBe(15);
  });

  it("uses numeric merchant ranks instead of decorative medal emoji", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData({
        top_merchants: [
          { name: "GoFood", expense_minor: 1_800_000, transaction_count: 25 },
          { name: "Superindo", expense_minor: 900_000, transaction_count: 4 },
          { name: "Tokopedia", expense_minor: 500_000, transaction_count: 3 }
        ]
      }),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Laporan")!;

    // Locate the three merchant rows by name and verify their rank column.
    const rankByName = new Map<string, unknown>();
    ws.eachRow((row) => {
      const name = String(row.getCell(2).value);
      if (["GoFood", "Superindo", "Tokopedia"].includes(name)) {
        rankByName.set(name, row.getCell(1).value);
      }
    });
    expect(rankByName.get("GoFood")).toBe(1);
    expect(rankByName.get("Superindo")).toBe(2);
    expect(rankByName.get("Tokopedia")).toBe(3);
  });

  it("appends a 6-month RATA-RATA row on the dashboard trend", async () => {
    const buffer = await buildReportWorkbook(
      buildReportData(),
      fallbackInsight,
      { userName: "Andi", aiModelLabel: "glm-4.7" }
    );
    const wb = await loadWorkbook(buffer);
    const ws = wb.getWorksheet("Laporan")!;

    let avgRow: ExcelJS.Row | null = null;
    ws.eachRow((row) => {
      if (String(row.getCell(1).value) === "RATA-RATA") avgRow = row;
    });
    expect(avgRow).not.toBeNull();
    expect(Number(avgRow!.getCell(2).value)).toBeCloseTo(8_183_333.33, -1);
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
    for (let c = 1; c <= 7; c++) {
      const width = ws.getColumn(c).width ?? 0;
      expect(width).toBeGreaterThanOrEqual(10);
      expect(width).toBeLessThanOrEqual(45);
    }
  });
});
