/**
 * Midtrans BI SNAP helper.
 *
 * BI SNAP (Bank Indonesia Standar Nasional Open API Pembayaran) is a separate
 * authentication layer on top of Midtrans used for specific payment methods
 * (QRIS, BI FAST, etc.) that require BI-mandated API standards.
 *
 * Flow:
 *  1. generateAccessToken() — POST to Midtrans BI SNAP auth endpoint using
 *     asymmetric signing (RSA-SHA256 of timestamp + client_id, signed with
 *     Midtrans-issued private key — or here we use client_secret as HMAC for
 *     sandbox; production requires your own RSA private key uploaded to Midtrans).
 *  2. Use the returned access_token as Bearer in BI SNAP API calls.
 *  3. verifyBisnapSignature() — verify inbound webhook signatures from Midtrans
 *     using the Midtrans-provided RSA public key.
 *
 * Env vars required:
 *   MIDTRANS_BISNAP_CLIENT_ID     — e.g. toxhKPEq-G092194647-SNAP
 *   MIDTRANS_BISNAP_CLIENT_SECRET — used for HMAC-SHA512 request signing (sandbox)
 *   MIDTRANS_BISNAP_PUBLIC_KEY    — RSA public key from Midtrans dashboard (PEM)
 *   MIDTRANS_IS_PRODUCTION        — "true" for production
 */

import { createHmac, createVerify } from "node:crypto";

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function getBisnapConfig() {
  const clientId     = process.env.MIDTRANS_BISNAP_CLIENT_ID ?? "";
  const clientSecret = process.env.MIDTRANS_BISNAP_CLIENT_SECRET ?? "";
  const publicKeyPem = (process.env.MIDTRANS_BISNAP_PUBLIC_KEY ?? "").replace(/\\n/g, "\n");
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

  if (!clientId || !clientSecret) {
    throw new Error("MIDTRANS_BISNAP_CLIENT_ID and MIDTRANS_BISNAP_CLIENT_SECRET are required.");
  }

  const baseUrl = isProduction
    ? "https://api.midtrans.com/v1/bis"
    : "https://api.sandbox.midtrans.com/v1/bis";

  return { clientId, clientSecret, publicKeyPem, isProduction, baseUrl };
}

// ---------------------------------------------------------------------------
// Access token (BI SNAP OAuth2)
// ---------------------------------------------------------------------------

export type BisnapAccessTokenResult = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;  // seconds
};

/**
 * Obtains a BI SNAP access token from Midtrans.
 *
 * Midtrans BI SNAP uses an asymmetric signing scheme:
 *   stringToSign = clientId + "|" + timestamp (ISO8601)
 *   signature    = base64( HMAC-SHA512(stringToSign, clientSecret) )  ← sandbox
 *
 * In production you would sign with your RSA-256 private key instead.
 */
export async function getBisnapAccessToken(): Promise<BisnapAccessTokenResult> {
  const { clientId, clientSecret, baseUrl } = getBisnapConfig();

  const timestamp = new Date().toISOString(); // e.g. 2024-01-01T00:00:00.000Z
  const stringToSign = `${clientId}|${timestamp}`;

  // Sandbox: HMAC-SHA512 with client secret
  const signature = createHmac("sha512", clientSecret)
    .update(stringToSign)
    .digest("base64");

  const response = await fetch(`${baseUrl}/v1.0/access-token/b2b`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CLIENT-KEY": clientId,
      "X-TIMESTAMP": timestamp,
      "X-SIGNATURE": signature,
    },
    body: JSON.stringify({ grantType: "client_credentials" }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`BI SNAP access token request failed (${response.status}): ${body}`);
  }

  const data = await response.json() as {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
  };

  return {
    accessToken: data.accessToken,
    tokenType:   data.tokenType ?? "Bearer",
    expiresIn:   data.expiresIn ?? 900,
  };
}

// ---------------------------------------------------------------------------
// Signature verification for inbound BI SNAP webhooks
// ---------------------------------------------------------------------------

/**
 * Verifies an inbound BI SNAP notification signature from Midtrans.
 *
 * Midtrans signs the webhook body with their RSA private key; we verify
 * using the public key from the dashboard (MIDTRANS_BISNAP_PUBLIC_KEY).
 *
 * The signature is typically sent in the X-SIGNATURE header.
 * stringToSign = clientId + ":" + httpMethod + ":" + relativeUrl + ":" + timestamp + ":" + lowercase(hex(sha256(body)))
 */
export function verifyBisnapSignature(params: {
  clientId: string;
  httpMethod: string;   // e.g. "POST"
  relativeUrl: string;  // e.g. "/api/payments/bisnap-webhook"
  timestamp: string;
  body: string;
  signatureHeader: string;
}): boolean {
  const { publicKeyPem } = getBisnapConfig();
  if (!publicKeyPem) {
    console.warn("[bisnap] MIDTRANS_BISNAP_PUBLIC_KEY not set — skipping signature verification");
    return false;
  }

  const { createHash } = require("node:crypto") as typeof import("node:crypto");

  const bodyHash = createHash("sha256").update(params.body, "utf8").digest("hex").toLowerCase();
  const stringToSign = [
    params.clientId,
    params.httpMethod.toUpperCase(),
    params.relativeUrl,
    params.timestamp,
    bodyHash,
  ].join(":");

  try {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(stringToSign);
    return verifier.verify(publicKeyPem, params.signatureHeader, "base64");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Simple in-memory token cache (avoids a new auth call on every request)
// ---------------------------------------------------------------------------

let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Returns a cached BI SNAP access token, refreshing it when expired.
 * Buffer of 60 s to avoid using a token right at expiry.
 */
export async function getCachedBisnapToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }

  const result = await getBisnapAccessToken();
  cachedToken = {
    token:     result.accessToken,
    expiresAt: now + (result.expiresIn - 60) * 1000,
  };
  return cachedToken.token;
}
