import type { CurrencyCode } from "./types";

const currencyFractions: Record<CurrencyCode, number> = {
  IDR: 0,
  MYR: 2,
  SGD: 2,
  USD: 2
};

export function formatCurrency(amountMinor: number, currency: CurrencyCode): string {
  const fractionDigits = currencyFractions[currency];
  const majorAmount = amountMinor / 10 ** fractionDigits;

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
