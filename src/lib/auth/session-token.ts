import { hasSupabaseAuthConfig } from "@/lib/supabase/config";

export const AUTH_COOKIE_NAME = "mf_access_token";

export type VerifiedAuthUser = {
  id: string;
  email: string;
  user_metadata: {
    display_name: string | null;
  };
};

export type VerifiedDemoToken = {
  provider: "demo";
  user: VerifiedAuthUser;
  expiresAt: number;
};

type DemoTokenPayload = {
  sub: string;
  email: string;
  display_name: string | null;
  provider: "demo";
  exp: number;
};

const encoder = new TextEncoder();
const demoTokenTtlSeconds = 60 * 60;

export function getAuthToken(input: { authorizationHeader?: string | null; cookieToken?: string | null }) {
  const bearer = input.authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return bearer || input.cookieToken?.trim() || null;
}

export async function createSignedDemoToken(input: { email: string; displayName?: string | null; now?: Date }) {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName?.trim() || null;
  const now = input.now ?? new Date();
  const payload: DemoTokenPayload = {
    sub: `demo:${email}`,
    email,
    display_name: displayName,
    provider: "demo",
    exp: Math.floor(now.getTime() / 1000) + demoTokenTtlSeconds
  };
  const encodedPayload = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await signPayload(encodedPayload);

  return {
    token: `demo.${encodedPayload}.${signature}`,
    expiresIn: demoTokenTtlSeconds
  };
}

export async function verifyDemoToken(token: string, now = new Date()): Promise<VerifiedDemoToken | null> {
  const [prefix, encodedPayload, signature] = token.split(".");

  if (prefix !== "demo" || !encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = await signPayload(encodedPayload);

  if (!timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  const payload = parsePayload(encodedPayload);

  if (!payload || payload.provider !== "demo" || payload.exp <= Math.floor(now.getTime() / 1000)) {
    return null;
  }

  return {
    provider: "demo",
    user: {
      id: payload.sub,
      email: payload.email,
      user_metadata: {
        display_name: payload.display_name
      }
    },
    expiresAt: payload.exp
  };
}

export function isDemoToken(token: string) {
  return token.startsWith("demo.");
}

export function isDemoAuthEnabled() {
  if (process.env.DEMO_AUTH_ENABLED === "true") {
    return true;
  }

  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return !hasSupabaseAuthConfig();
}

export function getDemoAuthSecret() {
  return process.env.DEMO_AUTH_SECRET ?? process.env.AUTH_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "financeapp-local-demo-secret";
}

async function signPayload(payload: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(getDemoAuthSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return encodeBase64Url(new Uint8Array(signature));
}

function parsePayload(encodedPayload: string): DemoTokenPayload | null {
  try {
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload))) as Partial<DemoTokenPayload>;

    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      (typeof payload.display_name !== "string" && payload.display_name !== null) ||
      payload.provider !== "demo" ||
      typeof payload.exp !== "number"
    ) {
      return null;
    }

    return payload as DemoTokenPayload;
  } catch {
    return null;
  }
}

function timingSafeEqual(a: string, b: string) {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < aBytes.length; index += 1) {
    diff |= aBytes[index] ^ bBytes[index];
  }

  return diff === 0;
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(input: string) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
