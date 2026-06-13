import { describe, expect, it } from "vitest";
import { isProtectedApiPath, isProtectedPagePath, isPublicPath, requiresAuth } from "../auth/route-guard";

describe("auth route guard", () => {
  it("requires auth for private app pages and nested private pages", () => {
    expect(isProtectedPagePath("/dashboard")).toBe(true);
    expect(isProtectedPagePath("/wallets")).toBe(true);
    expect(isProtectedPagePath("/transactions/new")).toBe(true);
    expect(isProtectedPagePath("/ai-transaction-review")).toBe(true);
  });

  it("keeps login, register, auth API, and static assets public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/register")).toBe(true);
    expect(isPublicPath("/api/auth/login")).toBe(true);
    expect(isPublicPath("/api/auth/register")).toBe(true);
    expect(isPublicPath("/_next/static/chunks/app.js")).toBe(true);
    expect(isPublicPath("/brand-mark.svg")).toBe(true);
  });

  it("requires auth for domain APIs but not auth APIs", () => {
    expect(isProtectedApiPath("/api/dashboard")).toBe(true);
    expect(isProtectedApiPath("/api/wallets")).toBe(true);
    expect(isProtectedApiPath("/api/uploads/init")).toBe(true);
    expect(isProtectedApiPath("/api/auth/login")).toBe(false);
  });

  it("is the single source for middleware auth decisions", () => {
    expect(requiresAuth("/dashboard")).toBe(true);
    expect(requiresAuth("/api/dashboard")).toBe(true);
    expect(requiresAuth("/login")).toBe(false);
  });
});
