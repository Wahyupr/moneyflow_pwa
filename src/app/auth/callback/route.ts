import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthRedirectUrl } from "@/lib/app-config";
import { exchangeGoogleCode } from "@/lib/auth/google";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { createSessionToken } from "@/lib/auth/session";
import {
  createUser,
  findUserByEmail,
  findUserByGoogleSub,
  markEmailVerified,
  provisionUser,
  setUserGoogleSub,
  type UserRow
} from "@/lib/auth/users";

export const runtime = "nodejs";

const PKCE_COOKIE = "g_pkce_verifier";
const STATE_COOKIE = "g_oauth_state";
const NEXT_COOKIE = "g_oauth_next";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (oauthError) {
    return clearOauthCookies(NextResponse.redirect(getAuthRedirectUrl("/login?error=oauth_denied")));
  }

  const verifier = request.cookies.get(PKCE_COOKIE)?.value;
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const next = sanitizeNext(request.cookies.get(NEXT_COOKIE)?.value ?? null);

  if (!code || !state || !verifier || !expectedState) {
    return clearOauthCookies(NextResponse.redirect(getAuthRedirectUrl("/login?error=missing_oauth_code")));
  }

  // CSRF protection: the state echoed by Google must match our cookie.
  if (state !== expectedState) {
    return clearOauthCookies(NextResponse.redirect(getAuthRedirectUrl("/login?error=oauth_exchange_failed")));
  }

  try {
    const profile = await exchangeGoogleCode({
      code,
      redirectUri: getAuthRedirectUrl("/auth/callback"),
      codeVerifier: verifier
    });

    const user = await upsertGoogleUser(profile);

    const { token, expiresIn } = createSessionToken({
      id: user.id,
      email: user.email,
      role: user.role,
      display_name: user.display_name
    });

    const response = NextResponse.redirect(getAuthRedirectUrl(next));
    setSessionCookie(response, token, expiresIn);
    return clearOauthCookies(response);
  } catch {
    return clearOauthCookies(NextResponse.redirect(getAuthRedirectUrl("/login?error=oauth_exchange_failed")));
  }
}

async function upsertGoogleUser(profile: {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}): Promise<UserRow> {
  const bySub = await findUserByGoogleSub(profile.sub);

  if (bySub) {
    await provisionUser({ userId: bySub.id, displayName: bySub.display_name ?? profile.name });
    return bySub;
  }

  const byEmail = await findUserByEmail(profile.email);

  if (byEmail) {
    // Link the Google identity to the existing account.
    await setUserGoogleSub(byEmail.id, profile.sub);
    if (!byEmail.email_verified_at) {
      await markEmailVerified(byEmail.id);
    }
    await provisionUser({ userId: byEmail.id, displayName: byEmail.display_name ?? profile.name });
    return byEmail;
  }

  // Google sign-in implies a verified email.
  const created = await createUser({
    email: profile.email,
    displayName: profile.name,
    googleSub: profile.sub,
    emailVerified: true
  });
  await provisionUser({ userId: created.id, displayName: profile.name });
  return created;
}

function clearOauthCookies(response: NextResponse) {
  response.cookies.delete(PKCE_COOKIE);
  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(NEXT_COOKIE);
  return response;
}

function sanitizeNext(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}
