import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { provisionAuthedUser } from "@/lib/auth/provision";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { getAuthRedirectUrl } from "@/lib/supabase/config";
import { createSupabaseRouteClient } from "@/lib/supabase/route-client";

export const runtime = "nodejs";

const validOtpTypes: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeNext(url.searchParams.get("next"));

  if (!tokenHash || !type || !validOtpTypes.includes(type)) {
    return NextResponse.redirect(getAuthRedirectUrl("/login?error=invalid_confirmation_link"));
  }

  const response = NextResponse.redirect(getAuthRedirectUrl(next));

  try {
    const supabase = createSupabaseRouteClient(request, response);
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (error || !data.session) {
      return NextResponse.redirect(getAuthRedirectUrl("/login?error=confirmation_failed"));
    }

    await provisionAuthedUser({
      userId: data.user?.id,
      accessToken: data.session.access_token,
      displayName: (data.user?.user_metadata?.display_name as string | undefined) ?? null
    });

    setSessionCookie(response, data.session.access_token, data.session.expires_in);
    return response;
  } catch {
    return NextResponse.redirect(getAuthRedirectUrl("/login?error=confirmation_failed"));
  }
}

function sanitizeNext(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
}
