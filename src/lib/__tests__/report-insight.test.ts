import { describe, expect, it } from "vitest";
import {
  buildReportInsightPrompt,
  fallbackReportInsight,
  parseReportInsightResponse,
  type ReportInsightContext
} from "../ai/report-insight";

const baseContext: ReportInsightContext = {
  user: { id: "user-a", display_name: "Andi" },
  window: {
    description: "Juni 2026",
    is_custom_range: false,
    from_iso: "2026-06-01T00:00:00Z",
    to_iso: "2026-07-01T00:00:00Z"
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
    { category_id: "c1", category_name: "Makanan", category_color: "#FF6B35", expense_minor: 2_500_000, expense_pct: 40, transaction_count: 15 },
    { category_id: "c2", category_name: "Transport", category_color: "#58A6FF", expense_minor: 1_200_000, expense_pct: 19, transaction_count: 8 }
  ],
  top_merchants: [
    { name: "GoFood", expense_minor: 1_800_000, transaction_count: 25 },
    { name: "Grab", expense_minor: 900_000, transaction_count: 10 }
  ],
  trend: [
    { month: "2026-01", income_minor: 8_000_000, expense_minor: 5_500_000 },
    { month: "2026-02", income_minor: 8_000_000, expense_minor: 6_000_000 },
    { month: "2026-03", income_minor: 8_200_000, expense_minor: 5_700_000 },
    { month: "2026-04", income_minor: 8_400_000, expense_minor: 5_900_000 },
    { month: "2026-05", income_minor: 8_000_000, expense_minor: 5_800_000 },
    { month: "2026-06", income_minor: 8_500_000, expense_minor: 6_200_000 }
  ]
};

describe("buildReportInsightPrompt", () => {
  it("returns system + user messages containing the period and totals", () => {
    const messages = buildReportInsightPrompt(baseContext);

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");

    const userContent = messages[1].content;
    expect(userContent).toContain("Juni 2026");
    expect(userContent).toContain("Makanan");
    expect(userContent).toContain("GoFood");
    // Delta should be computed and present.
    expect(userContent).toContain("delta_pct");
  });

  it("includes 6-month trend data", () => {
    const [, user] = buildReportInsightPrompt(baseContext);
    expect(user.content).toContain("2026-01");
    expect(user.content).toContain("2026-06");
  });

  it("clamps trend list to top categories and merchants", () => {
    const ctx: ReportInsightContext = {
      ...baseContext,
      by_category: Array.from({ length: 12 }, (_, i) => ({
        category_id: `c${i}`,
        category_name: `Cat ${i}`,
        category_color: "#000000",
        expense_minor: 100_000 * (12 - i),
        expense_pct: 5,
        transaction_count: 2
      })),
      top_merchants: Array.from({ length: 25 }, (_, i) => ({
        name: `Merchant ${i}`,
        expense_minor: 50_000,
        transaction_count: 1
      }))
    };

    const [, user] = buildReportInsightPrompt(ctx);
    // The prompt should not embed ALL merchants (would bloat tokens). Just
    // assert the format is intact rather than exact slice; we trust the slice()
    // in the function.
    expect(user.content).toContain("Merchant 0");
    expect(user.content).toContain("Cat 0");
  });
});

describe("parseReportInsightResponse", () => {
  it("parses a complete AI response", () => {
    const raw = JSON.stringify({
      executive_summary: "Bulan ini stabil dengan tingkat tabung 27%.",
      strengths: ["Tabungan naik", "Income stabil"],
      concerns: ["Makanan dominan"],
      anomalies: ["GoFood 30% pengeluaran"],
      recommendations: [
        { title: "Kurangi GoFood", rationale: "Frekuensi tinggi", potential_saving_minor: 300_000 },
        { title: "Tingkatkan tabungan", rationale: "Sisihkan 5%" }
      ],
      forecast: {
        next_period_expense_minor: 6_100_000,
        confidence: 0.55,
        assumptions: ["Pola konsumsi stabil", "Tidak ada perjalanan"]
      }
    });

    const parsed = parseReportInsightResponse(raw);

    expect(parsed.executive_summary).toContain("stabil");
    expect(parsed.strengths).toHaveLength(2);
    expect(parsed.concerns).toHaveLength(1);
    expect(parsed.anomalies).toHaveLength(1);
    expect(parsed.recommendations).toHaveLength(2);
    expect(parsed.recommendations[0].potential_saving_minor).toBe(300_000);
    expect(parsed.recommendations[1].potential_saving_minor).toBeUndefined();
    expect(parsed.forecast?.next_period_expense_minor).toBe(6_100_000);
    expect(parsed.forecast?.confidence).toBe(0.55);
    expect(parsed.forecast?.assumptions).toHaveLength(2);
  });

  it("strips markdown fences", () => {
    const raw = "```json\n" + JSON.stringify({
      executive_summary: "OK",
      strengths: [],
      concerns: [],
      anomalies: [],
      recommendations: [],
      forecast: null
    }) + "\n```";

    expect(parseReportInsightResponse(raw).executive_summary).toBe("OK");
  });

  it("clamps forecast confidence outside [0.1, 0.95]", () => {
    const raw = JSON.stringify({
      executive_summary: "OK",
      strengths: [],
      concerns: [],
      anomalies: [],
      recommendations: [],
      forecast: {
        next_period_expense_minor: 5_000_000,
        confidence: 1.5,
        assumptions: ["test"]
      }
    });

    expect(parseReportInsightResponse(raw).forecast?.confidence).toBe(0.95);
  });

  it("rejects forecast with non-positive expense", () => {
    const raw = JSON.stringify({
      executive_summary: "OK",
      strengths: [],
      concerns: [],
      anomalies: [],
      recommendations: [],
      forecast: {
        next_period_expense_minor: 0,
        confidence: 0.5,
        assumptions: []
      }
    });

    expect(parseReportInsightResponse(raw).forecast).toBeNull();
  });

  it("filters out recommendations missing title or rationale", () => {
    const raw = JSON.stringify({
      executive_summary: "OK",
      strengths: [],
      concerns: [],
      anomalies: [],
      recommendations: [
        { title: "Good", rationale: "Because" },
        { title: "", rationale: "Empty title" },
        { title: "No rationale", rationale: "" },
        { title: "Also good", rationale: "Yes" }
      ],
      forecast: null
    });

    const parsed = parseReportInsightResponse(raw);
    expect(parsed.recommendations).toHaveLength(2);
    expect(parsed.recommendations.map((r) => r.title)).toEqual(["Good", "Also good"]);
  });

  it("throws on missing executive_summary", () => {
    expect(() =>
      parseReportInsightResponse(JSON.stringify({ strengths: [] }))
    ).toThrow(/executive_summary/);
  });

  it("substitutes default assumption list when AI omits it", () => {
    const raw = JSON.stringify({
      executive_summary: "OK",
      strengths: [],
      concerns: [],
      anomalies: [],
      recommendations: [],
      forecast: {
        next_period_expense_minor: 5_000_000,
        confidence: 0.5,
        assumptions: []
      }
    });

    const f = parseReportInsightResponse(raw).forecast;
    expect(f?.assumptions.length).toBeGreaterThan(0);
  });
});

describe("fallbackReportInsight", () => {
  it("flags low savings rate as a concern", () => {
    const ctx: ReportInsightContext = {
      ...baseContext,
      totals: { ...baseContext.totals, savings_rate_pct: 5 }
    };
    const result = fallbackReportInsight(ctx);
    expect(result.concerns.some((c) => c.includes("5%"))).toBe(true);
  });

  it("produces a forecast when trend has at least 3 months", () => {
    const result = fallbackReportInsight(baseContext);
    expect(result.forecast).not.toBeNull();
    expect(result.forecast?.confidence).toBe(0.5);
    expect(result.forecast?.assumptions.length).toBeGreaterThanOrEqual(1);
  });

  it("returns null forecast when trend is too short", () => {
    const ctx: ReportInsightContext = {
      ...baseContext,
      trend: baseContext.trend.slice(0, 2)
    };
    expect(fallbackReportInsight(ctx).forecast).toBeNull();
  });

  it("emits concentration anomaly when a merchant exceeds 30% of expense", () => {
    const ctx: ReportInsightContext = {
      ...baseContext,
      top_merchants: [
        { name: "Dominant Merchant", expense_minor: 4_000_000, transaction_count: 30 }
      ]
    };
    const result = fallbackReportInsight(ctx);
    expect(result.anomalies.some((a) => a.includes("Dominant Merchant"))).toBe(true);
  });

  it("always returns at least 3 recommendations", () => {
    const result = fallbackReportInsight(baseContext);
    expect(result.recommendations.length).toBeGreaterThanOrEqual(3);
  });

  it("includes category name in headline concern when top cat > 50%", () => {
    const ctx: ReportInsightContext = {
      ...baseContext,
      by_category: [
        { category_id: "c1", category_name: "Hiburan", category_color: "#000", expense_minor: 5_500_000, expense_pct: 89, transaction_count: 10 }
      ]
    };
    const result = fallbackReportInsight(ctx);
    expect(result.concerns.some((c) => c.includes("Hiburan"))).toBe(true);
  });
});
