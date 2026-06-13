import { describe, expect, it } from "vitest";
import { buildArchivedWalletUpdate, validateWalletInput } from "../wallets";

describe("wallet payload validation", () => {
  it("requires a phone number for e-wallets", () => {
    const result = validateWalletInput({
      name: "GoPay",
      type: "ewallet",
      currency: "IDR",
      color: "#006948",
      icon: "smartphone",
      opening_balance_minor: 45_000
    });

    expect(result).toEqual({
      ok: false,
      errors: {
        phone_number: "Nomor HP wajib diisi untuk e-wallet."
      }
    });
  });

  it("requires an account number for bank wallets", () => {
    const result = validateWalletInput({
      name: "BCA Tahapan",
      type: "bank",
      currency: "IDR",
      color: "#006948",
      icon: "credit-card",
      opening_balance_minor: 850_000
    });

    expect(result).toEqual({
      ok: false,
      errors: {
        account_number: "Nomor rekening wajib diisi untuk rekening bank."
      }
    });
  });

  it("normalizes optional institution fields and keeps non-bank wallet identifiers nullable", () => {
    const result = validateWalletInput({
      name: "  Cash Harian  ",
      type: "cash",
      currency: "idr",
      color: "#85f8c4",
      icon: "wallet",
      institution_name: "  ",
      account_number: " ",
      phone_number: "",
      opening_balance_minor: 0
    });

    expect(result).toEqual({
      ok: true,
      data: {
        name: "Cash Harian",
        type: "cash",
        currency: "IDR",
        color: "#85f8c4",
        icon: "wallet",
        institution_name: null,
        account_number: null,
        phone_number: null,
        opening_balance_minor: 0
      }
    });
  });

  it("archives wallets instead of deleting ledger history", () => {
    expect(buildArchivedWalletUpdate("2026-06-13T03:00:00.000Z")).toEqual({
      archived_at: "2026-06-13T03:00:00.000Z"
    });
  });
});
