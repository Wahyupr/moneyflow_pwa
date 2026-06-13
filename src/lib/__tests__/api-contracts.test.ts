import { describe, expect, it } from "vitest";
import {
  buildEvidenceObjectKey,
  buildExtractionJob,
  createConfirmedTransactionPayload
} from "../api-contracts";
import { normalizeExtractionDraft } from "../extraction";

describe("API service contracts", () => {
  it("builds private storage keys scoped by user and ingestion", () => {
    expect(
      buildEvidenceObjectKey({
        userId: "user-a",
        ingestionId: "ing-001",
        fileName: "Bukti TF BCA 06/12.jpeg"
      })
    ).toBe("user-a/ing-001/bukti-tf-bca-06-12.jpeg");
  });

  it("creates queued AI extraction jobs from completed uploads", () => {
    expect(
      buildExtractionJob({
        ingestionId: "ing-001",
        userId: "user-a",
        documentType: "qris",
        fileSha256: "abc"
      })
    ).toMatchObject({
      ingestion_id: "ing-001",
      user_id: "user-a",
      document_type: "qris",
      file_sha256: "abc",
      status: "queued",
      attempts: 0
    });
  });

  it("turns a reviewed draft into a transaction insert payload", () => {
    const draft = normalizeExtractionDraft({
      document_type: "receipt",
      transaction_type: "expense",
      amount_minor: 55_000,
      currency: "IDR",
      occurred_at: "2026-06-12T10:00:00.000Z",
      merchant_name: "Netflix",
      payment_method: "CC BCA",
      confidence: 0.92
    });

    expect(
      createConfirmedTransactionPayload({
        draft,
        userId: "user-a",
        walletId: "wallet-a",
        categoryId: "subscription"
      })
    ).toMatchObject({
      user_id: "user-a",
      wallet_id: "wallet-a",
      category_id: "subscription",
      transaction_type: "expense",
      amount_minor: 55_000,
      currency: "IDR",
      merchant_name: "Netflix",
      payment_method: "CC BCA",
      input_method: "receipt_scan"
    });
  });

  it("preserves the draft input method when confirming voice drafts", () => {
    const draft = normalizeExtractionDraft({
      document_type: "unknown",
      transaction_type: "expense",
      amount_minor: 21_000,
      currency: "IDR",
      occurred_at: "2026-06-13T03:00:00.000Z",
      merchant_name: "Kopi Kenangan",
      payment_method: "GoPay",
      confidence: 0.92
    });

    expect(
      createConfirmedTransactionPayload({
        draft,
        userId: "user-a",
        walletId: "wallet-a",
        inputMethod: "voice"
      })
    ).toMatchObject({
      input_method: "voice"
    });
  });
});
