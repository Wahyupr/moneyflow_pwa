import { describe, expect, it } from "vitest";
import {
  buildDuplicateFingerprint,
  canConfirmDraft,
  normalizeExtractionDraft
} from "../extraction";

describe("AI extraction drafts", () => {
  it("marks low confidence document extraction as review-only", () => {
    const draft = normalizeExtractionDraft({
      document_type: "qris",
      transaction_type: "expense",
      amount_minor: 38_000,
      currency: "IDR",
      occurred_at: "2026-06-05T12:00:00.000Z",
      merchant_name: "Kopi Kenangan",
      confidence: 0.62
    });

    expect(draft.needs_review).toBe(true);
    expect(canConfirmDraft(draft)).toEqual({
      ok: false,
      reason: "Review required before saving this draft."
    });
  });

  it("creates a stable duplicate fingerprint per user and payment evidence", () => {
    const fingerprint = buildDuplicateFingerprint({
      userId: "user-a",
      fileSha256: "abc",
      referenceNumber: "INV-001",
      amountMinor: 55_000,
      occurredAt: "2026-06-05T12:00:00.000Z"
    });

    expect(fingerprint).toBe(
      buildDuplicateFingerprint({
        userId: "user-a",
        fileSha256: "abc",
        referenceNumber: "INV-001",
        amountMinor: 55_000,
        occurredAt: "2026-06-05T12:03:00.000Z"
      })
    );
    expect(fingerprint).not.toBe(
      buildDuplicateFingerprint({
        userId: "user-b",
        fileSha256: "abc",
        referenceNumber: "INV-001",
        amountMinor: 55_000,
        occurredAt: "2026-06-05T12:00:00.000Z"
      })
    );
  });
});
