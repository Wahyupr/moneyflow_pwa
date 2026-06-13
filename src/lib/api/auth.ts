import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, getAuthToken, isDemoAuthEnabled, isDemoToken, verifyDemoToken } from "@/lib/auth/session-token";
import { hasSupabaseServiceConfig } from "@/lib/supabase/config";
import { createSupabaseAuthClient, createSupabaseServiceClient, createSupabaseUserClient } from "@/lib/supabase/server";

export async function requireApiUser(request: NextRequest) {
  const token = getAuthToken({
    authorizationHeader: request.headers.get("authorization"),
    cookieToken: request.cookies.get(AUTH_COOKIE_NAME)?.value
  });

  if (!token) {
    return {
      response: NextResponse.json({ error: "Missing bearer token." }, { status: 401 })
    } as const;
  }

  if (isDemoToken(token)) {
    if (!isDemoAuthEnabled()) {
      return {
        response: NextResponse.json({ error: "Invalid or expired bearer token." }, { status: 401 })
      } as const;
    }

    const demo = await verifyDemoToken(token);

    if (!demo) {
      return {
        response: NextResponse.json({ error: "Invalid or expired bearer token." }, { status: 401 })
      } as const;
    }

    try {
      return { supabase: createSupabaseServiceClient(), user: demo.user } as const;
    } catch (error) {
      return {
        response: NextResponse.json(
          { error: error instanceof Error ? error.message : "Server auth is not configured." },
          { status: 503 }
        )
      } as const;
    }
  }

  try {
    const authClient = createSupabaseAuthClient();
    const { data, error } = await authClient.auth.getUser(token);

    if (error || !data.user) {
      return {
        response: NextResponse.json({ error: "Invalid or expired bearer token." }, { status: 401 })
      } as const;
    }

    return { supabase: createSupabaseUserClient(token), user: data.user } as const;
  } catch (error) {
    if (error instanceof Error && /Supabase (?:auth|service) environment variables are not configured/i.test(error.message)) {
      return {
        response: NextResponse.json({ error: "Invalid or expired bearer token." }, { status: 401 })
      } as const;
    }

    return {
      response: NextResponse.json(
        { error: error instanceof Error ? error.message : "Server auth is not configured." },
        { status: 503 }
      )
    } as const;
  }
}

/**
 * Like {@link requireApiUser} but also asserts the caller has the `admin` role
 * in their profile. On success it returns an elevated (service-role) Supabase
 * client so the admin can read/manage data across users.
 */
export async function requireApiAdmin(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth;
  }

  if (!hasSupabaseServiceConfig()) {
    return {
      response: NextResponse.json({ error: "Admin features require Supabase service configuration." }, { status: 503 })
    } as const;
  }

  let service: ReturnType<typeof createSupabaseServiceClient>;
  try {
    service = createSupabaseServiceClient();
  } catch (error) {
    return {
      response: NextResponse.json(
        { error: error instanceof Error ? error.message : "Server auth is not configured." },
        { status: 503 }
      )
    } as const;
  }

  const { data: profile, error } = await service.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();

  if (error) {
    return {
      response: NextResponse.json({ error: error.message }, { status: 500 })
    } as const;
  }

  if (profile?.role !== "admin") {
    return {
      response: NextResponse.json({ error: "Admin access required." }, { status: 403 })
    } as const;
  }

  return { supabase: service, user: auth.user } as const;
}
