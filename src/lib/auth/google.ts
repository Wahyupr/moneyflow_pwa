import { createHash, randomBytes } from "node:crypto";

/**
 * Direct Google OAuth 2.0 (OpenID Connect) with PKCE + state, replacing the
 * Supabase-managed flow. Client secret stays server-side; the PKCE verifier and
 * state are stored in short-lived httpOnly cookies during the redirect.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}

export function getGoogleClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}

export function hasGoogleConfig() {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

export function createPkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createState() {
  return randomBytes(16).toString("base64url");
}

export function buildGoogleAuthUrl(input: { redirectUri: string; state: string; codeChallenge: string }) {
  const params = new URLSearchParams({
    client_id: getGoogleClientId(),
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline",
    prompt: "select_account"
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
};

export async function exchangeGoogleCode(input: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<GoogleProfile> {
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier
    })
  });

  if (!tokenResponse.ok) {
    throw new Error("Google token exchange failed.");
  }

  const tokens = (await tokenResponse.json()) as { access_token?: string };

  if (!tokens.access_token) {
    throw new Error("Google token response missing access token.");
  }

  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { authorization: `Bearer ${tokens.access_token}` }
  });

  if (!userInfoResponse.ok) {
    throw new Error("Failed to load Google profile.");
  }

  const profile = (await userInfoResponse.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };

  if (!profile.sub || !profile.email) {
    throw new Error("Google profile missing required fields.");
  }

  return {
    sub: profile.sub,
    email: profile.email,
    emailVerified: Boolean(profile.email_verified),
    name: profile.name ?? null
  };
}
