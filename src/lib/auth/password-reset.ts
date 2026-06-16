import { query } from "@/lib/db/pool";
import { generateOtpCode, hashOtpCode, otpExpiry, OTP_RESEND_COOLDOWN_SECONDS, verifyOtpCode } from "@/lib/auth/otp";

/**
 * Forgot-password flow. Same OTP primitives as email verification, but stored
 * in a separate table so the two flows don't interfere.
 *
 * We never reveal whether an email exists; callers should respond with a
 * uniform "OK" message regardless of the lookup result (anti-enumeration).
 */

export type PasswordResetCodeRow = {
  id: string;
  user_id: string;
  code_hash: string;
  expires_at: string;
  consumed_at: string | null;
  attempts: number;
  last_sent_at: string;
};

export async function getActivePasswordResetCode(userId: string): Promise<PasswordResetCodeRow | null> {
  const result = await query<PasswordResetCodeRow>(
    `select id, user_id, code_hash, expires_at, consumed_at, attempts, last_sent_at
     from password_reset_codes
     where user_id = $1 and consumed_at is null
     order by created_at desc
     limit 1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

/** Replace any pending reset codes with a fresh one. Returns the raw code. */
export async function issuePasswordResetCode(userId: string): Promise<string> {
  const code = generateOtpCode();
  await query("delete from password_reset_codes where user_id = $1 and consumed_at is null", [userId]);
  await query(
    `insert into password_reset_codes (user_id, code_hash, expires_at)
     values ($1, $2, $3)`,
    [userId, hashOtpCode(code), otpExpiry().toISOString()]
  );
  return code;
}

export async function incrementResetAttempts(id: string): Promise<void> {
  await query("update password_reset_codes set attempts = attempts + 1 where id = $1", [id]);
}

export async function consumePasswordResetCode(id: string): Promise<void> {
  await query("update password_reset_codes set consumed_at = now() where id = $1", [id]);
}

/** Whether a fresh code can be sent right now (per `OTP_RESEND_COOLDOWN_SECONDS`). */
export function canResend(row: PasswordResetCodeRow | null): boolean {
  if (!row) return true;
  const elapsed = (Date.now() - new Date(row.last_sent_at).getTime()) / 1000;
  return elapsed >= OTP_RESEND_COOLDOWN_SECONDS;
}

/** Re-export for ergonomics. */
export { verifyOtpCode };
