import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthRedirectUrl } from "@/lib/supabase/config";
import { createSupabaseRouteClient } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const next = sanitizeNext(new URL(request.url).searchParams.get("next"));
  const callbackUrl = getAuthRedirectUrl(`/auth/callback?next=${encodeURIComponent(next)}`);

  // The response carries the PKCE code-verifier cookie that Supabase needs to
  // exchange the auth code on the callback. We redirect to it after the client
  // is built so that cookie is attached.
  const response = NextResponse.redirect(getAuthRedirectUrl("/login"));

  try {
    const supabase = createSupabaseRouteClient(request, response);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl
      }
    });

    if (error || !data.url) {
      return NextResponse.redirect(getAuthRedirectUrl("/login?error=oauth_init_failed"));
    }

    // Preserve the PKCE cookie set on `response` while redirecting to Google.
    const redirect = NextResponse.redirect(data.url);
    response.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie);
    });

    return redirect;
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
