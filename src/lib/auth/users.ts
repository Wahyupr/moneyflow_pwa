import { query } from "@/lib/db/pool";
import { hashOtpCode, generateOtpCode, otpExpiry } from "@/lib/auth/otp";

export type UserRow = {
  id: string;
  email: string;
  password_hash: string | null;
  display_name: string | null;
  role: "user" | "admin";
  google_sub: string | null;
  email_verified_at: string | null;
};

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await query<UserRow>(
    "select id, email, password_hash, display_name, role, google_sub, email_verified_at from users where lower(email) = lower($1) limit 1",
    [email]
  );
  return result.rows[0] ?? null;
}

export async function findUserByGoogleSub(sub: string): Promise<UserRow | null> {
  const result = await query<UserRow>(
    "select id, email, password_hash, display_name, role, google_sub, email_verified_at from users where google_sub = $1 limit 1",
    [sub]
  );
  return result.rows[0] ?? null;
}

export async function createUser(input: {
  email: string;
  passwordHash?: string | null;
  displayName?: string | null;
  googleSub?: string | null;
  emailVerified?: boolean;
}): Promise<UserRow> {
  const result = await query<UserRow>(
    `insert into users (email, password_hash, display_name, google_sub, email_verified_at)
     values ($1, $2, $3, $4, $5)
     returning id, email, password_hash, display_name, role, google_sub, email_verified_at`,
    [
      input.email,
      input.passwordHash ?? null,
      input.displayName ?? null,
      input.googleSub ?? null,
      input.emailVerified ? new Date().toISOString() : null
    ]
  );
  return result.rows[0];
}

export async function markEmailVerified(userId: string): Promise<void> {
  await query("update users set email_verified_at = now() where id = $1 and email_verified_at is null", [userId]);
}

export async function setUserGoogleSub(userId: string, sub: string): Promise<void> {
  await query("update users set google_sub = $1 where id = $2 and google_sub is null", [sub, userId]);
}

/**
 * Ensures the baseline profile + entitlement rows exist for a user. Idempotent
 * via upsert, so it is safe to call on every successful sign-in.
 */
export async function provisionUser(input: { userId: string; displayName?: string | null }): Promise<void> {
  await query(
    `insert into profiles (id, display_name, default_currency, locale)
     values ($1, $2, 'IDR', 'id-ID')
     on conflict (id) do update set display_name = coalesce(excluded.display_name, profiles.display_name)`,
    [input.userId, input.displayName?.trim() || null]
  );
  // Grant every new user a 1-month Premium free trial. We store it as an active
  // premium entitlement whose current_period_end is one month out; the gating
  // queries treat an entitlement whose period has lapsed as free (see the
  // `current_period_end is null or current_period_end > now()` filters), so the
  // trial automatically downgrades to free after a month without a cron job.
  await query(
    `insert into subscription_entitlements (user_id, plan, status, current_period_end)
     values ($1, 'premium', 'active', now() + interval '1 month')
     on conflict (user_id) do nothing`,
    [input.userId]
  );
}

/**
 * Creates a fresh verification code for the user, replacing any prior unused
 * ones. Returns the raw code so the caller can email it (never stored raw).
 */
export async function issueVerificationCode(userId: string): Promise<string> {
  const code = generateOtpCode();
  await query("delete from email_verification_codes where user_id = $1 and consumed_at is null", [userId]);
  await query(
    "insert into email_verification_codes (user_id, code_hash, expires_at) values ($1, $2, $3)",
    [userId, hashOtpCode(code), otpExpiry().toISOString()]
  );
  return code;
}

export type VerificationCodeRow = {
  id: string;
  user_id: string;
  code_hash: string;
  expires_at: string;
  consumed_at: string | null;
  attempts: number;
  last_sent_at: string;
};

export async function getActiveVerificationCode(userId: string): Promise<VerificationCodeRow | null> {
  const result = await query<VerificationCodeRow>(
    `select id, user_id, code_hash, expires_at, consumed_at, attempts, last_sent_at
     from email_verification_codes
     where user_id = $1 and consumed_at is null
     order by created_at desc
     limit 1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function incrementVerificationAttempts(id: string): Promise<void> {
  await query("update email_verification_codes set attempts = attempts + 1 where id = $1", [id]);
}

export async function consumeVerificationCode(id: string): Promise<void> {
  await query("update email_verification_codes set consumed_at = now() where id = $1", [id]);
}

export async function touchVerificationSentAt(id: string): Promise<void> {
  await query("update email_verification_codes set last_sent_at = now() where id = $1", [id]);
}

