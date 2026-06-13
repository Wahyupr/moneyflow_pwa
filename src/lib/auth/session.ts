import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Self-hosted session tokens (replaces Supabase access tokens).
 *
 * Format: <base64url(header)>.<base64url(payload)>.<base64url(signature)>
 * Signed with HS256 using AUTH_SECRET. Stateless and verified server-side on
 * every protected request.
 */

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionUser = {
  id: string;
  email: string;
  role: "user" | "admin";
  display_name: string | null;
};

type SessionPayload = {
  sub: string;
  email: string;
  role: "user" | "admin";
  display_name: string | null;
  iat: number;
  exp: number;
};

export const missingAuthSecretMessage = "AUTH_SECRET is not configured.";

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET ?? "";

  if (!secret || secret.length < 32) {
    throw new Error(missingAuthSecretMessage);
  }

  return secret;
}

export function createSessionToken(user: SessionUser, now = new Date()): { token: string; expiresIn: number } {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    display_name: user.display_name,
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS
  };

  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = encode(JSON.stringify(payload));
  const signature = sign(`${header}.${body}`);

  return { token: `${header}.${body}.${signature}`, expiresIn: SESSION_TTL_SECONDS };
}

export function verifySessionToken(token: string, now = new Date()): SessionUser | null {
  const segments = token.split(".");

  if (segments.length !== 3) {
    return null;
  }

  const [header, body, signature] = segments;
  const expectedSignature = sign(`${header}.${body}`);

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  let payload: SessionPayload;

  try {
    payload = JSON.parse(decode(body)) as SessionPayload;
  } catch {
    return null;
  }

  if (typeof payload.sub !== "string" || typeof payload.exp !== "number") {
    return null;
  }

  if (payload.exp <= Math.floor(now.getTime() / 1000)) {
    return null;
  }

  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role === "admin" ? "admin" : "user",
    display_name: payload.display_name ?? null
  };
}

function sign(input: string): string {
  return createHmac("sha256", getAuthSecret()).update(input).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);

  if (aBuf.length !== bBuf.length) {
    return false;
  }

  return timingSafeEqual(aBuf, bBuf);
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}
