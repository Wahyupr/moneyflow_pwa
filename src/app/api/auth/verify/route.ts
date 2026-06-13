import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { createSessionToken } from "@/lib/auth/session";
import { OTP_MAX_ATTEMPTS, verifyOtpCode } from "@/lib/auth/otp";
import {
  consumeVerificationCode,
  findUserByEmail,
  getActiveVerificationCode,
  incrementVerificationAttempts,
  markEmailVerified,
  provisionUser
} from "@/lib/auth/users";

export const runtime = "nodejs";

const VerifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/)
});

/**
 * Validates a 6-digit email verification code. On success, marks the email
 * verified and issues a session. Responses are intentionally generic to avoid
 * leaking whether the email exists.
 */
export async function POST(request: NextRequest) {
  const parsed = VerifySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Masukkan kode 6 digit yang valid." }, { status: 400 });
  }

  const genericError = NextResponse.json({ error: "Kode verifikasi salah atau kedaluwarsa." }, { status: 400 });

  try {
    const user = await findUserByEmail(parsed.data.email);

    if (!user) {
      return genericError;
    }

    if (user.email_verified_at) {
      return NextResponse.json({ error: "Email sudah diverifikasi. Silakan masuk." }, { status: 409 });
    }

    const record = await getActiveVerificationCode(user.id);

    if (!record) {
      return genericError;
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Terlalu banyak percobaan. Minta kode baru." },
        { status: 429 }
      );
    }

    if (new Date(record.expires_at).getTime() <= Date.now()) {
      return genericError;
    }

    if (!verifyOtpCode(parsed.data.code, record.code_hash)) {
      await incrementVerificationAttempts(record.id);
      return genericError;
    }

    await consumeVerificationCode(record.id);
    await markEmailVerified(user.id);
    await provisionUser({ userId: user.id, displayName: user.display_name });

    const { token, expiresIn } = createSessionToken({
      id: user.id,
      email: user.email,
      role: user.role,
      display_name: user.display_name
    });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email },
      session: { access_token: token, expires_in: expiresIn }
    });
    setSessionCookie(response, token, expiresIn);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed." },
      { status: 503 }
    );
  }
}
