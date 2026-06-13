import { NextResponse, type NextRequest } from "next/server";
import { isProtectedApiPath, requiresAuth } from "@/lib/auth/route-guard";
import { AUTH_COOKIE_NAME, getAuthToken } from "@/lib/auth/token";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!requiresAuth(pathname)) {
    return NextResponse.next();
  }

  const token = getAuthToken({
    authorizationHeader: request.headers.get("authorization"),
    cookieToken: request.cookies.get(AUTH_COOKIE_NAME)?.value
  });

  // Middleware runs on the Edge runtime where node:crypto signature
  // verification is unavailable, so it only performs a cheap structural +
  // expiry pre-check. Full HMAC verification happens in requireApiUser for API
  // routes (and on any server-rendered data fetch).
  if (!token || !hasUnexpiredShape(token)) {
    return unauthenticatedResponse(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/image|_next/static|favicon.ico).*)"]
};

function hasUnexpiredShape(token: string): boolean {
  const segments = token.split(".");

  if (segments.length !== 3) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8")) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function unauthenticatedResponse(request: NextRequest) {
  if (isProtectedApiPath(request.nextUrl.pathname)) {
    const response = NextResponse.json({ error: "Authentication required." }, { status: 401 });
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);

  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
