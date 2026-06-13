import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl, missingSupabaseAuthConfigMessage } from "@/lib/supabase/config";

/**
 * Creates a Supabase client for use inside route handlers that need the PKCE
 * flow (OAuth sign-in and email confirmation). The client persists short-lived
 * auth cookies (e.g. the PKCE code verifier) on the provided response so they
 * survive the redirect round-trip to the identity provider.
 */
export function createSupabaseRouteClient(request: NextRequest, response: NextResponse) {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();

  if (!url || !key) {
    throw new Error(missingSupabaseAuthConfigMessage);
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }

    }
  });
}
