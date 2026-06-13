import { describe, expect, it } from "vitest";
import { validateUploadRequest } from "../upload";

describe("payment evidence uploads", () => {
  it("accepts supported payment evidence document types and image files", () => {
    expect(
      validateUploadRequest({
        document_type: "bank_transfer",
        file_name: "bca-transfer.jpeg",
        content_type: "image/jpeg",
        size_bytes: 512_000
      })
    ).toEqual({ ok: true });
  });

  it("rejects unsupported files before they reach private storage", () => {
    expect(
      validateUploadRequest({
        document_type: "receipt",
        file_name: "statement.pdf",
        content_type: "application/pdf",
        size_bytes: 512_000
      })
    ).toEqual({
      ok: false,
      reason: "Only PNG, JPEG, and WebP payment evidence images are supported in MVP."
    });
  });
});
