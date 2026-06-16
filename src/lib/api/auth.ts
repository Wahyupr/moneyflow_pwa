import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createDatabaseClient, type DatabaseClient } from "@/lib/db/client";
import { AUTH_COOKIE_NAME, getAuthToken } from "@/lib/auth/token";

import { verifySessionToken, type SessionUser } from "@/lib/auth/session";

export type ApiUser = {
  id: string;
  email: string;
  role: "user" | "admin";
  user_metadata: { display_name: string | null };
};

function toApiUser(session: SessionUser): ApiUser {
  return {
    id: session.id,
    email: session.email,
    role: session.role,
    user_metadata: { display_name: session.display_name }
  };
}

/**
 * Authenticates a request using the self-hosted session token (cookie or
 * Authorization header). On success returns a Postgres-backed client plus the
 * verified user. Per-user data isolation is enforced by the route handlers'
 * explicit `user_id` filters against this client.
 */
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

  let session: SessionUser | null = null;

  try {
    session = verifySessionToken(token);
  } catch {
    return {
      response: NextResponse.json({ error: "Server auth is not configured." }, { status: 503 })
    } as const;
  }

  if (!session) {
    return {
      response: NextResponse.json({ error: "Invalid or expired bearer token." }, { status: 401 })
    } as const;
  }

  return { db: createDatabaseClient(), user: toApiUser(session) } as const;
}

/**
 * Like {@link requireApiUser} but asserts the caller has the `admin` role.
 * The role is taken from the signed session token and re-checked here.
 */
export async function requireApiAdmin(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth;
  }

  if (auth.user.role !== "admin") {
    return {
      response: NextResponse.json({ error: "Admin access required." }, { status: 403 })
    } as const;
  }

  return auth;
}

export type { DatabaseClient };
