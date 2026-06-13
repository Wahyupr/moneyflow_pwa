import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { provisionAuthedUser } from "@/lib/auth/provision";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { getAuthRedirectUrl } from "@/lib/supabase/config";
import { createSupabaseRouteClient } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const next = sanitizeNext(url.searchParams.get("next"));

  if (oauthError) {
    return NextResponse.redirect(getAuthRedirectUrl("/login?error=oauth_denied"));
  }

  if (!code) {
    return NextResponse.redirect(getAuthRedirectUrl("/login?error=missing_oauth_code"));
  }

  const response = NextResponse.redirect(getAuthRedirectUrl(next));

  try {
    const supabase = createSupabaseRouteClient(request, response);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      return NextResponse.redirect(getAuthRedirectUrl("/login?error=oauth_exchange_failed"));
    }

    await provisionAuthedUser({
      userId: data.user?.id,
      accessToken: data.session.access_token,
      displayName:
        (data.user?.user_metadata?.full_name as string | undefined) ??
        (data.user?.user_metadata?.name as string | undefined) ??
        (data.user?.user_metadata?.display_name as string | undefined) ??
        null
    });

    setSessionCookie(response, data.session.access_token, data.session.expires_in);
    return response;
  } catch {
    return NextResponse.redirect(getAuthRedirectUrl("/login?error=oauth_unavailable"));
  }
}

function sanitizeNext(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
}
