import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session-cookie";
import { createSessionToken } from "@/lib/auth/session";
import {
  createUser,
  findUserByEmail,
  issueVerificationCode,
  provisionUser,
  type UserRow
} from "@/lib/auth/users";
import { validateLoginInput, validateRegisterInput } from "@/lib/auth-validation";
import { sendVerificationEmail } from "@/lib/email/resend";
import { query } from "@/lib/db/pool";

// Brute-force protection constants
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({ email: "", password: "" }));
  const mode = new URL(request.url).searchParams.get("mode");

  if (mode === "register") {
    const validation = validateRegisterInput(body);

    if (!validation.ok) {
      return NextResponse.json({ errors: validation.errors }, { status: 422 });
    }

    return registerWithApi(validation.data);
  }

  const validation = validateLoginInput(body);

  if (!validation.ok) {
    return NextResponse.json({ errors: validation.errors }, { status: 422 });
  }

  return loginWithApi(validation.data);
}

async function loginWithApi(input: { email: string; password: string }) {
  try {
    const user = await findUserByEmail(input.email);

    // Check account lockout BEFORE verifying password so we don't waste bcrypt
    // cycles and also avoid leaking "account exists" information.
    if (user) {
      const lockedRow = await query<{ locked_until: string | null }>(
        "select locked_until from users where id = $1",
        [user.id]
      );
      const lockedUntil = lockedRow.rows[0]?.locked_until
        ? new Date(lockedRow.rows[0].locked_until)
        : null;
      if (lockedUntil && lockedUntil > new Date()) {
        const remainingMs = lockedUntil.getTime() - Date.now();
        const remainingMin = Math.ceil(remainingMs / 60_000);
        return NextResponse.json(
          { error: `Akun dikunci sementara karena terlalu banyak percobaan login. Coba lagi dalam ${remainingMin} menit.` },
          { status: 429 }
        );
      }
    }

    const passwordOk = await verifyPassword(input.password, user?.password_hash);

    // Uniform invalid-credentials response (no enumeration of which factor failed).
    if (!user || !passwordOk) {
      // Increment failed attempts and potentially lock the account.
      if (user) {
        await query(
          `update users
           set failed_login_attempts = failed_login_attempts + 1,
               locked_until = case
                 when failed_login_attempts + 1 >= $1
                 then now() + ($2 * interval '1 minute')
                 else null
               end
           where id = $3`,
          [MAX_ATTEMPTS, LOCK_MINUTES, user.id]
        );
      }
      return NextResponse.json({ error: "Email atau kata sandi salah." }, { status: 401 });
    }

    if (!user.email_verified_at) {
      return NextResponse.json(
        { error: "Email belum diverifikasi.", requiresEmailConfirmation: true, email: user.email },
        { status: 403 }
      );
    }

    // Successful login — reset the failure counter.
    await query(
      "update users set failed_login_attempts = 0, locked_until = null where id = $1",
      [user.id]
    );

    return issueSession(user);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Auth is not configured." },
      { status: 503 }
    );
  }
}

async function registerWithApi(input: { email: string; password: string; fullName: string }) {
  try {
    const existing = await findUserByEmail(input.email);

    if (!existing) {
      const passwordHash = await hashPassword(input.password);
      const user = await createUser({ email: input.email, passwordHash, displayName: input.fullName });
      const code = await issueVerificationCode(user.id);
      await safeSendVerification(input.email, code);
    } else if (!existing.email_verified_at) {
      const code = await issueVerificationCode(existing.id);
      await safeSendVerification(input.email, code);
    }

    return NextResponse.json({ requiresEmailConfirmation: true, email: input.email }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Auth is not configured." },
      { status: 503 }
    );
  }
}

async function issueSession(user: UserRow) {
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
}

async function safeSendVerification(email: string, code: string) {
  try {
    await sendVerificationEmail(email, code);
  } catch {
    // Don't leak provider errors; resend is available from the verify screen.
  }
}
