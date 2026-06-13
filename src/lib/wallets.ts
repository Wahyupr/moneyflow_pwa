import type { Result } from "@/lib/types";

export type WalletType = "cash" | "bank" | "ewallet" | "credit_card" | "savings" | "investment";

export type WalletInput = {
  name?: string;
  type?: WalletType;
  currency?: string;
  color?: string;
  icon?: string;
  institution_name?: string | null;
  account_number?: string | null;
  phone_number?: string | null;
  opening_balance_minor?: number;
};

export type WalletValidationResult =
  | {
      ok: true;
      data: {
        name: string;
        type: WalletType;
        currency: string;
        color: string;
        icon: string;
        institution_name: string | null;
        account_number: string | null;
        phone_number: string | null;
        opening_balance_minor: number;
      };
    }
  | { ok: false; errors: Record<string, string> };

const walletTypes: WalletType[] = ["cash", "bank", "ewallet", "credit_card", "savings", "investment"];

export function validateWalletInput(input: WalletInput): WalletValidationResult {
  const name = input.name?.trim() ?? "";
  const type = input.type;
  const currency = (input.currency?.trim() || "IDR").toUpperCase();
  const color = input.color?.trim() || "#006948";
  const icon = input.icon?.trim() || "wallet";
  const institutionName = nullableText(input.institution_name);
  const accountNumber = nullableText(input.account_number);
  const phoneNumber = nullableText(input.phone_number);
  const openingBalanceMinor = input.opening_balance_minor ?? 0;
  const errors: Record<string, string> = {};

  if (!name) {
    errors.name = "Nama dompet wajib diisi.";
  }

  if (!type || !walletTypes.includes(type)) {
    errors.type = "Tipe dompet tidak valid.";
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    errors.currency = "Mata uang harus 3 huruf.";
  }

  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    errors.color = "Warna harus format hex.";
  }

  if (!Number.isInteger(openingBalanceMinor)) {
    errors.opening_balance_minor = "Saldo awal harus angka bulat.";
  }

  if (type === "ewallet" && !phoneNumber) {
    errors.phone_number = "Nomor HP wajib diisi untuk e-wallet.";
  }

  if (type === "bank" && !accountNumber) {
    errors.account_number = "Nomor rekening wajib diisi untuk rekening bank.";
  }

  if (Object.keys(errors).length > 0 || !type) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    data: {
      name,
      type,
      currency,
      color,
      icon,
      institution_name: institutionName,
      account_number: accountNumber,
      phone_number: phoneNumber,
      opening_balance_minor: openingBalanceMinor
    }
  };
}

export function canArchiveWallet(_input: { transactionCount: number }): Result {
  return { ok: true };
}

export function buildArchivedWalletUpdate(_archivedAt: string) {
  return { archived_at: _archivedAt };
}

function nullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
