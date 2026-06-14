import { describe, expect, it } from "vitest";
import {
  buildMerchantLogoFileName,
  buildMerchantLogoPublicPath,
  isValidLogoReference,
  MERCHANT_LOGO_MAX_BYTES,
  validateMerchantLogo
} from "@/lib/merchant-logo";

describe("validateMerchantLogo", () => {
  it("accepts a png within the size limit", () => {
    expect(validateMerchantLogo({ contentType: "image/png", sizeBytes: 1024 })).toEqual({
      ok: true,
      extension: "png"
    });
  });

  it("maps jpeg to jpg and ignores charset suffix + casing", () => {
    expect(validateMerchantLogo({ contentType: "IMAGE/JPEG; charset=binary", sizeBytes: 2048 })).toEqual({
      ok: true,
      extension: "jpg"
    });
  });

  it("rejects unsupported content types", () => {
    const result = validateMerchantLogo({ contentType: "application/pdf", sizeBytes: 100 });
    expect(result.ok).toBe(false);
  });

  it("rejects empty files", () => {
    const result = validateMerchantLogo({ contentType: "image/png", sizeBytes: 0 });
    expect(result.ok).toBe(false);
  });

  it("rejects files larger than the limit", () => {
    const result = validateMerchantLogo({ contentType: "image/png", sizeBytes: MERCHANT_LOGO_MAX_BYTES + 1 });
    expect(result.ok).toBe(false);
  });
});

describe("file name + public path helpers", () => {
  it("appends the extension to the id", () => {
    expect(buildMerchantLogoFileName("abc-123", "webp")).toBe("abc-123.webp");
  });

  it("builds a public path under the uploads folder", () => {
    expect(buildMerchantLogoPublicPath("abc-123.webp")).toBe("/uploads/merchant-logos/abc-123.webp");
  });
});

describe("isValidLogoReference", () => {
  it("accepts empty string", () => {
    expect(isValidLogoReference("")).toBe(true);
  });

  it("accepts app-relative paths", () => {
    expect(isValidLogoReference("/uploads/merchant-logos/x.png")).toBe(true);
  });

  it("rejects protocol-relative paths", () => {
    expect(isValidLogoReference("//evil.com/x.png")).toBe(false);
  });

  it("accepts absolute http(s) URLs", () => {
    expect(isValidLogoReference("https://cdn.example.com/netflix.png")).toBe(true);
  });

  it("rejects non-http protocols", () => {
    expect(isValidLogoReference("javascript:alert(1)")).toBe(false);
  });
});
