import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { getAuthSecret } from "@/lib/auth/session";

/**
 * Email verification one-time codes.
 *
 * - 6-digit cryptographically-random code (randomInt is unbiased).
 * - Only the HMAC hash is persisted; the raw code is sent via email and never
 *   stored or logged.
 * - Codes expire and are single-use (enforced at the DB layer).
 */

export const OTP_TTL_SECONDS = 10 * 60; // 10 minutes
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** HMAC hash of the code, keyed by AUTH_SECRET, for storage. */
export function hashOtpCode(code: string): string {
  return createHmac("sha256", getAuthSecret()).update(code).digest("base64url");
}

/** Constant-time comparison of a submitted code against the stored hash. */
export function verifyOtpCode(code: string, storedHash: string): boolean {
  const expected = Buffer.from(hashOtpCode(code));
  const actual = Buffer.from(storedHash);

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}

export function otpExpiry(now = new Date()): Date {
  return new Date(now.getTime() + OTP_TTL_SECONDS * 1000);
}
