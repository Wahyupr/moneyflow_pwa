import { NextResponse, type NextRequest } from "next/server";
import { isProtectedApiPath, requiresAuth } from "@/lib/auth/route-guard";
import { AUTH_COOKIE_NAME, getAuthToken, isDemoAuthEnabled, isDemoToken, verifyDemoToken } from "@/lib/auth/session-token";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!requiresAuth(pathname)) {
    return NextResponse.next();
  }

  const token = getAuthToken({
    authorizationHeader: request.headers.get("authorization"),
    cookieToken: request.cookies.get(AUTH_COOKIE_NAME)?.value
  });

  if (!token || !(await isValidSessionToken(token))) {
    return unauthenticatedResponse(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/image|_next/static|favicon.ico).*)"]
};

async function isValidSessionToken(token: string) {
  if (isDemoToken(token)) {
    return isDemoAuthEnabled() && (await verifyDemoToken(token)) !== null;
  }

  return verifySupabaseToken(token);
}

async function verifySupabaseToken(token: string) {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();

  if (!url || !key) {
    return false;
  }

  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: key,
        authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });

    return response.ok;
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
