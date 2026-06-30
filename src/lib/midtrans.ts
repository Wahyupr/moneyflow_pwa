/**
 * Midtrans Snap helper.
 *
 * Uses the official `midtrans-client` Node SDK.
 * Set these env vars:
 *   MIDTRANS_SERVER_KEY   — server key from Midtrans dashboard
 *   MIDTRANS_CLIENT_KEY   — client key (exposed to browser)
 *   MIDTRANS_IS_PRODUCTION — "true" in prod, absent/false for sandbox
 */

import MidtransClient from "midtrans-client";

export type SnapOrderParams = {
  orderId: string;
  amount: number;          // IDR, integer
  customerName: string;
  customerEmail: string;
  itemId: string;          // e.g. "premium-monthly"
  itemName: string;        // e.g. "MoneyFlow Premium (Bulanan)"
};

export type SnapTokenResult = {
  token: string;
  redirectUrl: string;
};

function getSnapClient() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? "";
  if (!serverKey) {
    throw new Error("MIDTRANS_SERVER_KEY is not configured.");
  }

  return new MidtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
    serverKey,
    clientKey: process.env.MIDTRANS_CLIENT_KEY ?? "",
  });
}

/**
 * Creates a Midtrans Snap transaction and returns the popup token
 * plus a fallback redirect URL.
 */
export async function createSnapToken(params: SnapOrderParams): Promise<SnapTokenResult> {
  const snap = getSnapClient();

  const parameter = {
    transaction_details: {
      order_id: params.orderId,
      gross_amount: params.amount,
    },
    customer_details: {
      first_name: params.customerName,
      email: params.customerEmail,
    },
    item_details: [
      {
        id: params.itemId,
        price: params.amount,
        quantity: 1,
        name: params.itemName,
      },
    ],
    // Allow all common payment methods in Indonesia
    enabled_payments: [
      "credit_card",
      "gopay",
      "shopeepay",
      "other_qris",
      "permata_va",
      "bca_va",
      "bni_va",
      "bri_va",
      "cimb_va",
      "danamon_va",
      "echannel",
      "indomaret",
      "alfamart",
    ],
    callbacks: {
      finish: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/pricing?payment=finish`,
      error:  `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/pricing?payment=error`,
      pending: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/pricing?payment=pending`,
    },
  };

  const result = await snap.createTransaction(parameter) as { token: string; redirect_url: string };
  return { token: result.token, redirectUrl: result.redirect_url };
}

/**
 * Verifies the Midtrans webhook notification signature.
 *
 * Midtrans sends:
 *   signature_key = SHA512( order_id + status_code + gross_amount + server_key )
 */
export function verifyMidtransSignature(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}): boolean {
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? "";
  const expected = createHash("sha512")
    .update(`${params.orderId}${params.statusCode}${params.grossAmount}${serverKey}`)
    .digest("hex");
  return expected === params.signatureKey;
}

/** Returns the public client key for use in the browser Snap JS. */
export function getMidtransClientKey(): string {
  return process.env.MIDTRANS_CLIENT_KEY ?? "";
}
