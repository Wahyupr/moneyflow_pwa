import type { DocumentType } from "@/lib/types";

const documentLabels: Record<DocumentType, string> = {
  qris: "QRIS payment screenshot",
  bank_transfer: "bank transfer receipt or mobile banking screenshot",
  ewallet_transfer: "e-wallet transfer or payment screenshot",
  receipt: "merchant receipt",
  unknown: "Indonesian payment evidence"
};

export function buildExtractionPrompt(documentType: DocumentType): string {
  return [
    "You are a finance OCR and payment evidence parser for an Indonesia-first personal finance PWA.",
    `Document type hint: ${documentLabels[documentType]}.`,
    "Extract a transaction draft from the image.",
    "Return JSON only. Do not include markdown, comments, or explanation.",
    "Required JSON keys: document_type, transaction_type, amount_minor, currency, occurred_at, merchant_name, counterparty_name, payment_method, reference_number, line_items, confidence, needs_review, warnings.",
    "Use IDR as default currency. amount_minor for IDR is whole rupiah. If direction is ambiguous for transfer evidence, set transaction_type to transfer and needs_review to true.",
    "Set confidence from 0 to 1. Mark needs_review true for missing amount/date/type, low image quality, or ambiguous transfer direction."
  ].join("\n");
}

export function parseExtractionJson(text: string): unknown {
  const withoutFence = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  return JSON.parse(withoutFence);
}
