import { afterEach, describe, expect, it, vi } from "vitest";
import { isDemoAuthEnabled, verifyDemoToken } from "../auth/session-token";
import { createDemoSession, getAuthApiEndpoint, getPostAuthRedirect, isMissingSupabaseConfigError } from "../demo-auth";

describe("demo auth fallback", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...originalEnv };
  });

  it("creates an API session for a locally registered account", async () => {
    await expect(
      createDemoSession({
        email: "nara@example.com",
        displayName: "Nara Putri"
      })
    ).resolves.toMatchObject({
      user: {
        email: "nara@example.com",
        user_metadata: {
          display_name: "Nara Putri"
        }
      },
      session: {
        token_type: "bearer",
        expires_in: 3600
      },
      provider: "demo"
    });
  });

  it("creates a signed demo token that can be verified by route guards", async () => {
    const demo = await createDemoSession({
      email: "NARA@example.com",
      displayName: "Nara Putri"
    });

    await expect(verifyDemoToken(demo.session.access_token)).resolves.toMatchObject({
      user: {
        id: "demo:nara@example.com",
        email: "nara@example.com",
        user_metadata: {
          display_name: "Nara Putri"
        }
      }
    });
  });

  it("rejects tampered demo tokens", async () => {
    const demo = await createDemoSession({
      email: "nara@example.com",
      displayName: "Nara Putri"
    });

    await expect(verifyDemoToken(`${demo.session.access_token}x`)).resolves.toBeNull();
  });

  it("redirects to dashboard after API auth returns a session", () => {
    expect(getPostAuthRedirect({ session: { access_token: "demo-token" } })).toBe("/dashboard");
    expect(getPostAuthRedirect({ session: null })).toBeNull();
  });

  it("uses the stable session endpoint for login and register forms", () => {
    expect(getAuthApiEndpoint("login")).toBe("/api/auth/login");
    expect(getAuthApiEndpoint("register")).toBe("/api/auth/login?mode=register");
  });

  it("detects missing Supabase environment errors", () => {
    expect(isMissingSupabaseConfigError(new Error("Supabase service environment variables are not configured."))).toBe(true);
    expect(isMissingSupabaseConfigError(new Error("Invalid login credentials"))).toBe(false);
  });

  it("does not enable demo auth automatically in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.DEMO_AUTH_ENABLED;

    expect(isDemoAuthEnabled()).toBe(false);

    process.env.DEMO_AUTH_ENABLED = "true";

    expect(isDemoAuthEnabled()).toBe(true);
  });

  it("does not enable demo auth when Supabase publishable auth config exists", () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_example";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.DEMO_AUTH_ENABLED;

    expect(isDemoAuthEnabled()).toBe(false);
  });
});
