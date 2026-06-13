export const AUTH_COOKIE_NAME = "mf_access_token";

/**
 * Extracts the session token from either the Authorization bearer header or the
 * session cookie. Header takes precedence.
 */
export function getAuthToken(input: { authorizationHeader?: string | null; cookieToken?: string | null }) {
  const bearer = input.authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return bearer || input.cookieToken?.trim() || null;
}
