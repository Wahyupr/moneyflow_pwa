import { describe, expect, it } from "vitest";
import { formatCurrency, parseMoneyToMinor } from "../money";

describe("money helpers", () => {
  it("formats IDR minor units without fractional digits", () => {
    expect(formatCurrency(24_750_000, "IDR")).toBe("Rp24.750.000");
    expect(formatCurrency(-2_100_000, "IDR")).toBe("-Rp2.100.000");
  });

  it("parses local money strings into currency minor units", () => {
    expect(parseMoneyToMinor("55.000", "IDR")).toBe(55_000);
    expect(parseMoneyToMinor("12.34", "USD")).toBe(1_234);
  });
});
