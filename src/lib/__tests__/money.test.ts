import { describe, expect, it } from "vitest";
import { amountMinorToMajor, formatCurrency, parseMoneyToMinor } from "../money";

describe("money helpers", () => {
  it("formats IDR minor units without fractional digits", () => {
    expect(formatCurrency(24_750_000, "IDR")).toBe("Rp24.750.000");
    expect(formatCurrency(-2_100_000, "IDR")).toBe("-Rp2.100.000");
  });

  it("parses local money strings into currency minor units", () => {
    expect(parseMoneyToMinor("55.000", "IDR")).toBe(55_000);
    expect(parseMoneyToMinor("12.34", "USD")).toBe(1_234);
  });

  it("converts minor units to Excel-ready major amounts per currency", () => {
    expect(amountMinorToMajor(75_000, "IDR")).toBe(75_000);
    expect(amountMinorToMajor(12_345, "USD")).toBe(123.45);
    expect(amountMinorToMajor(-9_999, "SGD")).toBe(-99.99);
  });
});
