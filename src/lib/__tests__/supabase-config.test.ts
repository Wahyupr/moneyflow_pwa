import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseElevatedKey, getSupabasePublishableKey, hasSupabaseAuthConfig, hasSupabaseServiceConfig } from "../supabase/config";

describe("Supabase environment config", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...originalEnv };
  });

  it("uses the new Supabase publishable key for auth config", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_example";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(getSupabasePublishableKey()).toBe("sb_publishable_example");
    expect(hasSupabaseAuthConfig()).toBe(true);
    expect(hasSupabaseServiceConfig()).toBe(false);
  });

  it("keeps backward compatibility with the older anon key env name", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_example";
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    expect(getSupabasePublishableKey()).toBe("anon_example");
    expect(hasSupabaseAuthConfig()).toBe(true);
  });

  it("uses the new Supabase secret key for server-side elevated operations", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_example";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(getSupabaseElevatedKey()).toBe("sb_secret_example");
    expect(hasSupabaseServiceConfig()).toBe(true);
  });
});
