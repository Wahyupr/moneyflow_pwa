export function getPostAuthRedirect(input: { session?: { access_token?: string | null } | null }) {
  return input.session?.access_token ? "/dashboard" : null;
}

export function getAuthApiEndpoint(mode: "login" | "register") {
  return mode === "register" ? "/api/auth/login?mode=register" : "/api/auth/login";
}
