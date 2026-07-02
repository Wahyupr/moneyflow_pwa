// Manual implementation of Midtrans API calls to avoid SDK build issues.
import { createHash } from "node:crypto";

const SNAP_SANDBOX_URL = "https://app.sandbox.midtrans.com/snap/v1/transactions";
const SNAP_PRODUCTION_URL = "https://app.midtrans.com/snap/v1/transactions";

export type SnapOrderParams = {
  orderId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  itemId: string;
  itemName:string;
};

export type SnapTokenResult = {
  token: string;
  redirectUrl: string;
};

/**
 * Creates a Midtrans Snap transaction token by calling the API directly.
 */
export async function createSnapToken(params: SnapOrderParams): Promise<SnapTokenResult> {
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? "";
  if (!serverKey) {
    throw new Error("MIDTRANS_SERVER_KEY is not configured.");
  }

  const apiUrl = isProduction ? SNAP_PRODUCTION_URL : SNAP_SANDBOX_URL;
  
  // Base64 encode the server key for the Authorization header
  const authString = Buffer.from(serverKey + ":").toString("base64");

  const payload = {
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
    enabled_payments: [
      "credit_card", "gopay", "shopeepay", "other_qris", "permata_va", 
      "bca_va", "bni_va", "bri_va", "cimb_va", "danamon_va", "echannel", 
      "indomaret", "alfamart"
    ],
    callbacks: {
      finish: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/pricing?payment=finish`,
      error:  `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/pricing?payment=error`,
      pending: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/pricing?payment=pending`,
    },
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Basic ${authString}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Midtrans API Error:", errorBody);
    throw new Error(`Midtrans API request failed with status ${response.status}`);
  }

  const result = await response.json() as { token: string; redirect_url: string; error_messages?: string[] };

  if (result.error_messages) {
    throw new Error(`Midtrans API returned an error: ${result.error_messages.join(", ")}`);
  }

  return { token: result.token, redirectUrl: result.redirect_url };
}

/**
 * Verifies the Midtrans webhook notification signature manually.
 */
export function verifyNotification(notificationPayload: any): any {
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? "";
  if (!serverKey) {
    throw new Error("MIDTRANS_SERVER_KEY is not configured for verification.");
  }

  const { order_id, status_code, gross_amount, signature_key } = notificationPayload;

  if (!order_id || !status_code || !gross_amount || !signature_key) {
    throw new Error("Invalid notification payload for signature verification.");
  }

  const expectedSignature = createHash("sha512")
    .update(`${order_id}${status_code}${gross_amount}${serverKey}`)
    .digest("hex");

  if (expectedSignature !== signature_key) {
    console.warn(`[Webhook Auth] Failed signature check for order_id: ${order_id}.`);
    throw new Error("Invalid signature key.");
  }

  return notificationPayload;
}

export function getMidtransClientKey(): string {
  return process.env.MIDTRANS_CLIENT_KEY ?? "";
}
