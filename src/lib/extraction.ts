import type { CurrencyCode, DocumentType, ExtractionDraft, ExtractionLineItem, Result, TransactionType } from "./types";

type RawExtractionDraft = Partial<{
  document_type: DocumentType;
  transaction_type: TransactionType;
  amount_minor: number;
  currency: CurrencyCode;
  occurred_at: string;
  merchant_name: string;
  counterparty_name: string;
  payment_method: string;
  reference_number: string;
  line_items: ExtractionLineItem[];
  confidence: number;
  needs_review: boolean;
  warnings: string[];
}>;

const REVIEW_THRESHOLD = 0.75;

export function normalizeExtractionDraft(raw: RawExtractionDraft): ExtractionDraft {
  const confidence = clamp(raw.confidence ?? 0, 0, 1);
  const warnings = [...(raw.warnings ?? [])];

  if (confidence < REVIEW_THRESHOLD) {
    warnings.push("Low confidence extraction. Please review all fields.");
  }

  if (!raw.amount_minor) {
    warnings.push("Amount is missing.");
  }

  if (!raw.occurred_at) {
    warnings.push("Transaction date is missing.");
  }

  const needsReview =
    raw.needs_review === true ||
    confidence < REVIEW_THRESHOLD ||
    !raw.amount_minor ||
    !raw.transaction_type ||
    !raw.occurred_at;

  return {
    document_type: raw.document_type ?? "unknown",
    transaction_type: raw.transaction_type ?? null,
    amount_minor: raw.amount_minor ?? null,
    currency: raw.currency ?? "IDR",
    occurred_at: raw.occurred_at ?? null,
    merchant_name: raw.merchant_name?.trim() || null,
    counterparty_name: raw.counterparty_name?.trim() || null,
    payment_method: raw.payment_method?.trim() || null,
    reference_number: raw.reference_number?.trim() || null,
    line_items: raw.line_items ?? [],
    confidence,
    needs_review: needsReview,
    warnings: [...new Set(warnings)]
  };
}

export function canConfirmDraft(draft: ExtractionDraft): Result {
  if (draft.needs_review) {
    return { ok: false, reason: "Review required before saving this draft." };
  }

  if (!draft.transaction_type || draft.amount_minor === null || !draft.occurred_at) {
    return { ok: false, reason: "Amount, type, and date are required before saving." };
  }

  return { ok: true };
}

export function buildDuplicateFingerprint(input: {
  userId: string;
  fileSha256: string;
  referenceNumber: string | null;
  amountMinor: number | null;
  occurredAt: string | null;
}): string {
  const day = input.occurredAt ? input.occurredAt.slice(0, 10) : "unknown-date";
  const payload = [
    input.userId,
    input.fileSha256.toLowerCase(),
    input.referenceNumber?.toLowerCase().trim() ?? "no-ref",
    input.amountMinor ?? "no-amount",
    day
  ].join("|");

  return fnv1a(payload);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
