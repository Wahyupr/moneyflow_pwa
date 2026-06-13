import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthRedirectUrl } from "@/lib/app-config";
import { buildGoogleAuthUrl, createPkcePair, createState, hasGoogleConfig } from "@/lib/auth/google";

export const runtime = "nodejs";

const PKCE_COOKIE = "g_pkce_verifier";
const STATE_COOKIE = "g_oauth_state";
const NEXT_COOKIE = "g_oauth_next";

export async function GET(request: NextRequest) {
  if (!hasGoogleConfig()) {
    return NextResponse.redirect(getAuthRedirectUrl("/login?error=oauth_unavailable"));
  }

  const next = sanitizeNext(new URL(request.url).searchParams.get("next"));
  const redirectUri = getAuthRedirectUrl("/auth/callback");
  const { verifier, challenge } = createPkcePair();
  const state = createState();

  const response = NextResponse.redirect(
    buildGoogleAuthUrl({ redirectUri, state, codeChallenge: challenge })
  );

  // Short-lived, httpOnly cookies carry the PKCE verifier + CSRF state across
  // the redirect to Google and back to the callback.
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10
  };

  response.cookies.set(PKCE_COOKIE, verifier, cookieOptions);
  response.cookies.set(STATE_COOKIE, state, cookieOptions);
  response.cookies.set(NEXT_COOKIE, next, cookieOptions);

  return response;
}

function sanitizeNext(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}
