import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { OTP_RESEND_COOLDOWN_SECONDS } from "@/lib/auth/otp";
import { findUserByEmail, getActiveVerificationCode, issueVerificationCode } from "@/lib/auth/users";
import { sendVerificationEmail } from "@/lib/email/resend";

export const runtime = "nodejs";

const ResendSchema = z.object({
  email: z.string().email()
});

/**
 * Re-issues a verification code, throttled by a per-code cooldown. The response
 * is uniform regardless of whether the account exists or is already verified
 * (anti-enumeration + anti-spam).
 */
export async function POST(request: NextRequest) {
  const parsed = ResendSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Masukkan email yang valid." }, { status: 400 });
  }

  const neutral = NextResponse.json({ ok: true });

  try {
    const user = await findUserByEmail(parsed.data.email);

    if (!user || user.email_verified_at) {
      return neutral;
    }

    const existing = await getActiveVerificationCode(user.id);

    if (existing) {
      const elapsed = (Date.now() - new Date(existing.last_sent_at).getTime()) / 1000;
      if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
        return NextResponse.json(
          { error: "Tunggu sebentar sebelum meminta kode baru." },
          { status: 429 }
        );
      }
    }

    const code = await issueVerificationCode(user.id);

    try {
      await sendVerificationEmail(parsed.data.email, code);
    } catch {
      // Don't leak provider details.
    }

    return neutral;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Resend failed." },
      { status: 503 }
    );
  }
}
