import type { CurrencyCode } from "./types";

export const currencyFractions: Record<CurrencyCode, number> = {
  IDR: 0,
  MYR: 2,
  SGD: 2,
  USD: 2
};

export function amountMinorToMajor(amountMinor: number, currency: CurrencyCode): number {
  return amountMinor / 10 ** currencyFractions[currency];
}

export function formatCurrency(amountMinor: number, currency: CurrencyCode): string {
  const fractionDigits = currencyFractions[currency];
  const majorAmount = amountMinorToMajor(amountMinor, currency);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  })
    .format(majorAmount)
    .replace(/\s/g, "");
}

export function parseMoneyToMinor(input: string, currency: CurrencyCode): number {
  const fractionDigits = currencyFractions[currency];
  const normalized = input.trim().replace(/[^\d.,-]/g, "");

  if (!normalized) {
    return 0;
  }

  const decimalSeparator = fractionDigits === 0 ? null : detectDecimalSeparator(normalized);
  const sign = normalized.startsWith("-") ? -1 : 1;
  const unsigned = normalized.replace(/^-/, "");

  if (decimalSeparator === null) {
    return sign * Number(unsigned.replace(/[.,]/g, ""));
  }

  const [majorRaw, fractionRaw = ""] = unsigned.split(decimalSeparator);
  const major = Number(majorRaw.replace(/[.,]/g, "") || "0");
  const fraction = Number(fractionRaw.padEnd(fractionDigits, "0").slice(0, fractionDigits));

  return sign * (major * 10 ** fractionDigits + fraction);
}

function detectDecimalSeparator(value: string): "." | "," {
  const lastDot = value.lastIndexOf(".");
  const lastComma = value.lastIndexOf(",");

  return lastComma > lastDot ? "," : ".";
}

/**
 * Format raw digits string (or number) to thousand-separated display string.
 * "10000" → "10.000", 1500000 → "1.500.000"
 */
export function formatThousands(value: string | number): string {
  const digits =
    typeof value === "number"
      ? String(Math.round(Math.abs(value)))
      : value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Strip thousand separators so the raw digits string can be parsed.
 * "10.000" → "10000"
 */
export function parseThousands(value: string): string {
  return value.replace(/\./g, "");
}
