import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAuthRedirectUrl, getSiteUrl } from "../app-config";

import { isProtectedApiPath, isPublicPath } from "../auth/route-guard";

describe("auth redirect URL helpers", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalAppBaseUrl = process.env.APP_BASE_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.APP_BASE_URL;
    delete process.env.NEXT_PUBLIC_APP_BASE_URL;
  });

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }

    if (originalAppBaseUrl === undefined) {
      delete process.env.APP_BASE_URL;
    } else {
      process.env.APP_BASE_URL = originalAppBaseUrl;
    }
  });

  it("falls back to localhost when nothing is configured", () => {
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("strips trailing slashes from the configured site URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com/";
    expect(getSiteUrl()).toBe("https://app.example.com");
  });

  it("prefers NEXT_PUBLIC_SITE_URL over APP_BASE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://primary.example.com";
    process.env.APP_BASE_URL = "https://fallback.example.com";
    expect(getSiteUrl()).toBe("https://primary.example.com");
  });

  it("builds absolute redirect URLs and normalizes the path", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.com";
    expect(getAuthRedirectUrl("/auth/callback")).toBe("https://app.example.com/auth/callback");
    expect(getAuthRedirectUrl("auth/confirm")).toBe("https://app.example.com/auth/confirm");
  });
});

describe("auth route guard for new endpoints", () => {
  it("treats Google OAuth init endpoint as public", () => {
    expect(isPublicPath("/api/auth/google")).toBe(true);
    expect(isProtectedApiPath("/api/auth/google")).toBe(false);
  });

  it("treats OAuth callback and verify-email pages as public", () => {
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/verify-email")).toBe(true);
  });


  it("still protects application API routes", () => {
    expect(isProtectedApiPath("/api/dashboard")).toBe(true);
    expect(isPublicPath("/api/dashboard")).toBe(false);
  });
});
