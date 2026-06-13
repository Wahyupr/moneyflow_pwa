export const missingSupabaseAuthConfigMessage = "Supabase auth environment variables are not configured.";
export const missingSupabaseServiceConfigMessage = "Supabase service environment variables are not configured.";

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

export function getSupabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

export function getSupabaseElevatedKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function hasSupabaseAuthConfig() {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

export function hasSupabaseServiceConfig() {
  return Boolean(getSupabaseUrl() && getSupabaseElevatedKey());
}

export function getSupabasePublicConfig() {
  const publishableKey = getSupabasePublishableKey();

  return {
    url: getSupabaseUrl(),
    publishableKey,
    anonKey: publishableKey
  };
}

export function getSiteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_BASE_URL ??
    "http://localhost:3000";

  return raw.replace(/\/+$/, "");
}

export function getAuthRedirectUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

