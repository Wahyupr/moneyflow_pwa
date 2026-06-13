import { describe, expect, it } from "vitest";
import { buildExtractionPrompt, parseExtractionJson } from "../ai/extraction";

describe("AI extraction orchestration", () => {
  it("builds a strict JSON prompt for Indonesian payment evidence", () => {
    expect(buildExtractionPrompt("qris")).toContain("Return JSON only");
    expect(buildExtractionPrompt("qris")).toContain("QRIS");
    expect(buildExtractionPrompt("qris")).toContain("amount_minor");
  });

  it("parses model JSON wrapped in markdown fences", () => {
    expect(
      parseExtractionJson('```json\n{"document_type":"receipt","amount_minor":55000,"currency":"IDR"}\n```')
    ).toMatchObject({
      document_type: "receipt",
      amount_minor: 55_000,
      currency: "IDR"
    });
  });
});
