import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { createUser, findUserByEmail, issueVerificationCode } from "@/lib/auth/users";
import { validateRegisterInput } from "@/lib/auth-validation";
import { sendVerificationEmail } from "@/lib/email/resend";

export const runtime = "nodejs";

/**
 * Registers a new user with email + password, then issues a 6-digit
 * verification code by email. The response is intentionally uniform whether or
 * not the email already exists (anti user-enumeration).
 */
export async function POST(request: NextRequest) {
  const validation = validateRegisterInput(
    await request.json().catch(() => ({ fullName: "", email: "", password: "", acceptedTerms: false }))
  );

  if (!validation.ok) {
    return NextResponse.json({ errors: validation.errors }, { status: 422 });
  }

  const { email, password, fullName } = validation.data;

  try {
    const existing = await findUserByEmail(email);

    if (!existing) {
      const passwordHash = await hashPassword(password);
      const user = await createUser({ email, passwordHash, displayName: fullName });
      const code = await issueVerificationCode(user.id);
      await safeSendVerification(email, code);
    } else if (!existing.email_verified_at) {
      // Account exists but unverified: re-issue a code so the user can finish.
      const code = await issueVerificationCode(existing.id);
      await safeSendVerification(email, code);
    }
    // If the account exists and is already verified, do nothing but still
    // return the same neutral response below.

    return NextResponse.json(
      {
        requiresEmailConfirmation: true,
        email
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration failed." },
      { status: 503 }
    );
  }
}

async function safeSendVerification(email: string, code: string) {
  try {
    await sendVerificationEmail(email, code);
  } catch {
    // Swallow provider errors so we don't leak internal details. The user can
    // request a resend from the verification screen.
  }
}
