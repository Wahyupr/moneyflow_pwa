import { canConfirmDraft } from "./extraction";
import type { CurrencyCode, DocumentType, ExtractionDraft, TransactionType } from "./types";

export type ExtractionJobStatus = "queued" | "processing" | "succeeded" | "failed";

export type ExtractionJobInsert = {
  ingestion_id: string;
  user_id: string;
  document_type: DocumentType;
  file_sha256: string;
  status: ExtractionJobStatus;
  attempts: number;
};

export type TransactionInsert = {
  user_id: string;
  wallet_id: string;
  category_id: string | null;
  transaction_type: TransactionType;
  amount_minor: number;
  currency: CurrencyCode;
  occurred_at: string;
  merchant_name: string | null;
  payment_method: string | null;
  note: string | null;
  input_method: "manual" | "receipt_scan" | "evidence_upload" | "voice" | "auto_recurring";
};

export function buildEvidenceObjectKey(input: {
  userId: string;
  ingestionId: string;
  fileName: string;
}): string {
  return `${input.userId}/${input.ingestionId}/${slugFileName(input.fileName)}`;
}

export function buildExtractionJob(input: {
  ingestionId: string;
  userId: string;
  documentType: DocumentType;
  fileSha256: string;
}): ExtractionJobInsert {
  return {
    ingestion_id: input.ingestionId,
    user_id: input.userId,
    document_type: input.documentType,
    file_sha256: input.fileSha256,
    status: "queued",
    attempts: 0
  };
}

export function createConfirmedTransactionPayload(input: {
  draft: ExtractionDraft;
  userId: string;
  walletId: string;
  categoryId?: string | null;
  note?: string | null;
  inputMethod?: TransactionInsert["input_method"];
}): TransactionInsert {
  const confirmResult = canConfirmDraft(input.draft);

  if (!confirmResult.ok) {
    throw new Error(confirmResult.reason);
  }

  if (!input.draft.transaction_type || input.draft.amount_minor === null || !input.draft.occurred_at) {
    throw new Error("Amount, type, and date are required before saving.");
  }

  return {
    user_id: input.userId,
    wallet_id: input.walletId,
    category_id: input.categoryId ?? null,
    transaction_type: input.draft.transaction_type,
    amount_minor: input.draft.amount_minor,
    currency: input.draft.currency,
    occurred_at: input.draft.occurred_at,
    merchant_name: input.draft.merchant_name,
    payment_method: input.draft.payment_method,
    note: input.note ?? null,
    input_method: input.inputMethod ?? (input.draft.document_type === "receipt" ? "receipt_scan" : "evidence_upload")
  };
}

function slugFileName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  const base = dotIndex === -1 ? fileName : fileName.slice(0, dotIndex);
  const extension = dotIndex === -1 ? "" : fileName.slice(dotIndex + 1).toLowerCase();
  const slug = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return extension ? `${slug || "payment-evidence"}.${extension}` : slug || "payment-evidence";
}
