import { describe, expect, it } from "vitest";
import { buildVoiceDraftInsert, createDraftPatch } from "../drafts";

describe("voice transaction drafts", () => {
  it("turns a transcript into a review-only voice draft insert", () => {
    const result = buildVoiceDraftInsert({
      userId: "user-a",
      transcript: "Beli kopi 21 rb di Kopi Kenangan pakai GoPay",
      occurredAt: "2026-06-13T03:00:00.000Z"
    });

    expect(result).toMatchObject({
      user_id: "user-a",
      input_method: "voice",
      source_text: "Beli kopi 21 rb di Kopi Kenangan pakai GoPay",
      status: "pending_review",
      extracted_json: {
        document_type: "unknown",
        transaction_type: "expense",
        amount_minor: 21_000,
        currency: "IDR",
        occurred_at: "2026-06-13T03:00:00.000Z",
        merchant_name: "Kopi Kenangan",
        payment_method: "GoPay",
        confidence: 0.62,
        needs_review: true
      }
    });
  });

  it("rejects empty transcripts", () => {
    expect(() =>
      buildVoiceDraftInsert({
        userId: "user-a",
        transcript: "   ",
        occurredAt: "2026-06-13T03:00:00.000Z"
      })
    ).toThrow("Transcript is required.");
  });

  it("creates a safe draft patch without changing ownership fields", () => {
    expect(
      createDraftPatch({
        amount_minor: 55_000,
        merchant_name: "Starbucks",
        user_id: "different-user",
        status: "confirmed"
      })
    ).toEqual({
      extracted_json: {
        amount_minor: 55_000,
        merchant_name: "Starbucks"
      }
    });
  });
});
