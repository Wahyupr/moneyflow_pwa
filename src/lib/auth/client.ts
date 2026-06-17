export function getPostAuthRedirect(input: { session?: { access_token?: string | null } | null }) {
  if (!input.session?.access_token) return null;
  // Route through the welcome interstitial so password sign-in sees the same
  // post-login confirmation screen as OAuth (and the premium celebration when
  // the user's plan is premium).
  return "/auth/welcome?next=/dashboard";
}

export function getAuthApiEndpoint(mode: "login" | "register") {
  return mode === "register" ? "/api/auth/login?mode=register" : "/api/auth/login";
}
