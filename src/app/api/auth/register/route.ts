import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { provisionAuthedUser } from "@/lib/auth/provision";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { isDemoAuthEnabled } from "@/lib/auth/session-token";
import { validateRegisterInput } from "@/lib/auth-validation";
import { createDemoSession, isMissingSupabaseConfigError } from "@/lib/demo-auth";
import { getAuthRedirectUrl } from "@/lib/supabase/config";
import { createSupabaseAuthClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const validation = validateRegisterInput(
    await request.json().catch(() => ({ fullName: "", email: "", password: "", acceptedTerms: false }))
  );

  if (!validation.ok) {
    return NextResponse.json({ errors: validation.errors }, { status: 422 });
  }

  try {
    const supabase = createSupabaseAuthClient();
    const { data, error } = await supabase.auth.signUp({
      email: validation.data.email,
      password: validation.data.password,
      options: {
        emailRedirectTo: getAuthRedirectUrl("/auth/confirm"),
        data: {
          display_name: validation.data.fullName
        }
      }
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // When "Confirm email" is enabled in Supabase, signUp returns a user but no
    // session. The user must click the confirmation link before they can sign in.
    if (!data.session) {
      return NextResponse.json(
        {
          user: data.user,
          session: null,
          requiresEmailConfirmation: true
        },
        { status: 201 }
      );
    }

    await provisionAuthedUser({
      userId: data.user?.id,
      accessToken: data.session.access_token,
      displayName: validation.data.fullName
    });

    const response = NextResponse.json({ user: data.user, session: data.session }, { status: 201 });
    setSessionCookie(response, data.session.access_token, data.session.expires_in);
    return response;
  } catch (error) {
    if (isMissingSupabaseConfigError(error) && isDemoAuthEnabled()) {
      const demo = await createDemoSession({ email: validation.data.email, displayName: validation.data.fullName });
      const response = NextResponse.json(demo, { status: 201 });
      setSessionCookie(response, demo.session.access_token, demo.session.expires_in);
      return response;
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Auth is not configured." }, { status: 503 });
  }
}
