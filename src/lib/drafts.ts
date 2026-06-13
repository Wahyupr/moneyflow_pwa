import type { ExtractionDraft } from "@/lib/types";

type DraftInputMethod = "manual" | "receipt_scan" | "evidence_upload" | "voice" | "auto_recurring";

export function buildVoiceDraftInsert(input: { userId: string; transcript: string; occurredAt: string }) {
  const transcript = input.transcript.trim();

  if (!transcript) {
    throw new Error("Transcript is required.");
  }

  return {
    user_id: input.userId,
    input_method: "voice" satisfies DraftInputMethod,
    source_text: transcript,
    status: "pending_review",
    extracted_json: buildDraftFromTranscript(transcript, input.occurredAt)
  };
}

export function createDraftPatch(input: Record<string, unknown>) {
  const allowedKeys = [
    "document_type",
    "transaction_type",
    "amount_minor",
    "currency",
    "occurred_at",
    "merchant_name",
    "counterparty_name",
    "payment_method",
    "reference_number",
    "line_items",
    "confidence",
    "needs_review",
    "warnings"
  ];
  const extractedJson: Record<string, unknown> = {};

  for (const key of allowedKeys) {
    if (key in input) {
      extractedJson[key] = input[key];
    }
  }

  return { extracted_json: extractedJson };
}

function buildDraftFromTranscript(transcript: string, occurredAt: string): ExtractionDraft {
  return {
    document_type: "unknown",
    transaction_type: inferTransactionType(transcript),
    amount_minor: inferAmount(transcript),
    currency: "IDR",
    occurred_at: occurredAt,
    merchant_name: inferMerchantName(transcript),
    counterparty_name: null,
    payment_method: inferPaymentMethod(transcript),
    reference_number: null,
    line_items: [],
    confidence: 0.62,
    needs_review: true,
    warnings: ["Draft dari suara perlu dicek sebelum disimpan."]
  };
}

function inferTransactionType(transcript: string): ExtractionDraft["transaction_type"] {
  return /\b(gaji|terima|masuk|income|dibayar)\b/i.test(transcript) ? "income" : "expense";
}

function inferAmount(transcript: string): number | null {
  const match = transcript.match(/(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|juta|jt)?/i);

  if (!match) {
    return null;
  }

  const value = Number(match[1].replace(",", "."));
  const suffix = match[2]?.toLowerCase();

  if (!Number.isFinite(value)) {
    return null;
  }

  if (suffix === "juta" || suffix === "jt") {
    return Math.round(value * 1_000_000);
  }

  if (suffix === "rb" || suffix === "ribu" || suffix === "k") {
    return Math.round(value * 1_000);
  }

  return Math.round(value);
}

function inferMerchantName(transcript: string): string | null {
  const match = transcript.match(/\bdi\s+(.+?)(?:\s+pakai|\s+dengan|\s+via|$)/i);
  return match?.[1]?.trim() || null;
}

function inferPaymentMethod(transcript: string): string | null {
  const match = transcript.match(/\b(?:pakai|dengan|via)\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
