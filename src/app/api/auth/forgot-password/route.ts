import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_SECONDS } from "@/lib/auth/otp";
import {
  canResend,
  consumePasswordResetCode,
  getActivePasswordResetCode,
  incrementResetAttempts,
  issuePasswordResetCode,
  verifyOtpCode
} from "@/lib/auth/password-reset";
import { hashPassword } from "@/lib/auth/password";
import { findUserByEmail } from "@/lib/auth/users";
import { sendPasswordResetEmail } from "@/lib/email/resend";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

/**
 * Three-step password reset flow on a single endpoint, switched by `step`:
 *
 *   step="request"  → email + send code (anti-enumeration: always 200)
 *   step="verify"   → email + code, returns OK if valid (no consumption yet)
 *   step="reset"    → email + code + newPassword, consumes the code & updates
 *
 * The 2-minute resend cooldown comes from `OTP_RESEND_COOLDOWN_SECONDS` and
 * is enforced both server- and client-side.
 */

const RequestSchema = z.object({ step: z.literal("request"), email: z.string().email() });
const VerifySchema = z.object({ step: z.literal("verify"), email: z.string().email(), code: z.string().regex(/^\d{6}$/) });
const ResetSchema = z.object({
  step: z.literal("reset"),
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(8).max(128)
});
const Body = z.union([RequestSchema, VerifySchema, ResetSchema]);

export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }
  const data = parsed.data;

  if (data.step === "request") {
    return handleRequest(data.email);
  }
  if (data.step === "verify") {
    return handleVerify(data.email, data.code);
  }
  return handleReset(data.email, data.code, data.newPassword);
}

async function handleRequest(email: string) {
  const neutral = NextResponse.json({ ok: true });
  try {
    const user = await findUserByEmail(email);
    // Don't reveal whether the email exists — but still honor the cooldown so
    // an attacker can't fish for "rate limited" responses to enumerate.
    if (!user) {
      return neutral;
    }

    const existing = await getActivePasswordResetCode(user.id);
    if (existing && !canResend(existing)) {
      // Generic message; don't expose remaining seconds (slow-fail by design).
      return NextResponse.json(
        { error: `Tunggu ${OTP_RESEND_COOLDOWN_SECONDS} detik sebelum meminta kode baru.` },
        { status: 429 }
      );
    }

    const code = await issuePasswordResetCode(user.id);
    try {
      await sendPasswordResetEmail(email, code);
    } catch {
      // Don't leak provider errors. The user can resend after the cooldown.
    }
    return neutral;
  } catch {
    return neutral;
  }
}

async function handleVerify(email: string, code: string) {
  const generic = NextResponse.json({ error: "Kode salah atau sudah kedaluwarsa." }, { status: 400 });
  const user = await findUserByEmail(email);
  if (!user) return generic;

  const row = await getActivePasswordResetCode(user.id);
  if (!row) return generic;
  if (row.attempts >= OTP_MAX_ATTEMPTS) return generic;
  if (new Date(row.expires_at).getTime() < Date.now()) return generic;

  if (!verifyOtpCode(code, row.code_hash)) {
    await incrementResetAttempts(row.id);
    return generic;
  }

  return NextResponse.json({ ok: true });
}

async function handleReset(email: string, code: string, newPassword: string) {
  const generic = NextResponse.json({ error: "Kode salah atau sudah kedaluwarsa." }, { status: 400 });
  const user = await findUserByEmail(email);
  if (!user) return generic;

  const row = await getActivePasswordResetCode(user.id);
  if (!row) return generic;
  if (row.attempts >= OTP_MAX_ATTEMPTS) return generic;
  if (new Date(row.expires_at).getTime() < Date.now()) return generic;

  if (!verifyOtpCode(code, row.code_hash)) {
    await incrementResetAttempts(row.id);
    return generic;
  }

  const hash = await hashPassword(newPassword);
  await query("update users set password_hash = $1 where id = $2", [hash, user.id]);
  await consumePasswordResetCode(row.id);

  return NextResponse.json({ ok: true });
}
