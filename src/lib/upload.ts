import type { DocumentType, Result } from "./types";

const supportedDocumentTypes = new Set<DocumentType>(["qris", "bank_transfer", "ewallet_transfer", "receipt", "unknown"]);
const supportedContentTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxUploadSizeBytes = 8 * 1024 * 1024;

export function validateUploadRequest(input: {
  document_type: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
}): Result {
  if (!supportedDocumentTypes.has(input.document_type as DocumentType)) {
    return { ok: false, reason: "Unsupported payment evidence document type." };
  }

  if (!supportedContentTypes.has(input.content_type)) {
    return {
      ok: false,
      reason: "Only PNG, JPEG, and WebP payment evidence images are supported in MVP."
    };
  }

  if (input.size_bytes > maxUploadSizeBytes) {
    return { ok: false, reason: "Payment evidence image must be 8 MB or smaller." };
  }

  if (!/\.(png|jpe?g|webp)$/i.test(input.file_name)) {
    return { ok: false, reason: "File extension must match PNG, JPEG, or WebP." };
  }

  return { ok: true };
}
