const protectedPagePrefixes = [
  "/dashboard",
  "/admin",
  "/wallets",
  "/transactions",
  "/reports",
  "/reminders",
  "/settings",
  "/voice-input",
  "/ai-transaction-review",
  "/hutang",
  "/piutang",
  "/merchants",
  "/categories",
  "/payments/history",
];

const publicPagePaths = new Set(["/", "/login", "/register", "/verify-email", "/forgot-password", "/pricing", "/faq", "/kontak", "/syarat-ketentuan", "/kebijakan-refund"]);
const publicPagePrefixes = ["/auth/callback"];
const publicApiPrefixes = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/google",
  "/api/auth/verify",
  "/api/auth/resend",
  "/api/auth/forgot-password",
  // Cron endpoint — secured by CRON_SECRET bearer token, not user session
  "/api/notifications/trigger",
  // Midtrans sends webhook from their servers — no user session available
  "/api/payments/webhook",
  // Midtrans BI SNAP webhook — server-to-server, no user session
  "/api/payments/bisnap-webhook"
];


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
