const protectedPagePrefixes = [
  "/dashboard",
  "/admin",
  "/wallets",
  "/transactions",
  "/reports",
  "/reminders",
  "/settings",
  "/voice-input",
  "/ai-transaction-review"
];

const publicPagePaths = new Set(["/", "/login", "/register"]);
const publicPagePrefixes = ["/auth/callback", "/auth/confirm"];
const publicApiPrefixes = ["/api/auth/login", "/api/auth/register", "/api/auth/logout", "/api/auth/google"];

const publicAssetPrefixes = ["/_next", "/favicon.ico", "/manifest.webmanifest", "/sw.js"];
const publicFilePattern = /\.(?:avif|css|gif|ico|jpg|jpeg|js|json|png|svg|txt|webp|woff2?)$/i;

export function isProtectedPagePath(pathname: string) {
  return protectedPagePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isProtectedApiPath(pathname: string) {
  return pathname.startsWith("/api/") && !publicApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isPublicPath(pathname: string) {
  return (
    publicPagePaths.has(pathname) ||
    publicPagePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    publicApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||

    publicAssetPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    publicFilePattern.test(pathname)
  );
}

export function requiresAuth(pathname: string) {
  return isProtectedPagePath(pathname) || isProtectedApiPath(pathname);
}
