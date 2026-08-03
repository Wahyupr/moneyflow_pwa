/**
 * POST /api/payments/bisnap-webhook
 *
 * Receives BI SNAP payment notifications from Midtrans.
 * Midtrans signs the request with their RSA private key — we verify
 * using MIDTRANS_BISNAP_PUBLIC_KEY.
 *
 * This endpoint must be registered in Midtrans dashboard →
 * Settings → BI SNAP → Notification URL.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/pool";
import { verifyBisnapSignature } from "@/lib/midtrans-bisnap";

// BI SNAP notification body shape (partial — only fields we need)
type BisnapNotification = {
  partnerReferenceNo?: string;   // our order_id
  referenceNo?: string;          // Midtrans reference
  latestTransactionStatus?: string;
  transactionStatusDesc?: string;
  amount?: { value?: string; currency?: string };
  additionalInfo?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // BI SNAP signature verification
  const clientId     = process.env.MIDTRANS_BISNAP_CLIENT_ID ?? "";
  const timestamp    = request.headers.get("X-TIMESTAMP") ?? "";
  const sigHeader    = request.headers.get("X-SIGNATURE") ?? "";
  const relativeUrl  = "/api/payments/bisnap-webhook";

  const valid = verifyBisnapSignature({
    clientId,
    httpMethod:      "POST",
    relativeUrl,
    timestamp,
    body:            rawBody,
    signatureHeader: sigHeader,
  });

  // In sandbox the public key may not be set; only reject if key is present
  if (process.env.MIDTRANS_BISNAP_PUBLIC_KEY && !valid) {
    console.warn("[bisnap-webhook] Invalid signature — rejecting");
    return NextResponse.json({ responseCode: "4010000", responseMessage: "Unauthorized" }, { status: 401 });
  }

  let notification: BisnapNotification;
  try {
    notification = JSON.parse(rawBody) as BisnapNotification;
  } catch {
    return NextResponse.json({ responseCode: "4000000", responseMessage: "Bad Request" }, { status: 400 });
  }

  const orderId = notification.partnerReferenceNo;
  const status  = (notification.latestTransactionStatus ?? "").toLowerCase();

  console.log(`[bisnap-webhook] order=${orderId} status=${status}`);

  if (!orderId) {
    return NextResponse.json({ responseCode: "4000000", responseMessage: "Missing partnerReferenceNo" }, { status: 400 });
  }

  try {
    if (status === "00" || status === "settlement" || status === "capture") {
      // Payment successful — activate subscription
      await query(
        `update payment_orders set status = 'paid', updated_at = now() where order_id = $1`,
        [orderId]
      );

      // Fetch order details to determine plan and billing cycle
      const orderRes = await query<{
        user_id: string;
        plan: string;
        billing_cycle: string;
        amount: number;
      }>(
        `select user_id, plan, billing_cycle, amount from payment_orders where order_id = $1`,
        [orderId]
      );

      const order = orderRes.rows[0];
      if (order) {
        const monthsMap: Record<string, number> = { monthly: 1, yearly: 12 };
        const months = monthsMap[order.billing_cycle] ?? 1;

        await query(
          `insert into subscription_entitlements
             (user_id, plan, billing_cycle, amount_paid, starts_at, expires_at, payment_order_id, created_by)
           values
             ($1, $2, $3, $4, now(), now() + ($5 || ' months')::interval, $6, 'bisnap_webhook')
           on conflict (user_id) do update set
             plan             = excluded.plan,
             billing_cycle    = excluded.billing_cycle,
             amount_paid      = excluded.amount_paid,
             starts_at        = excluded.starts_at,
             expires_at       = excluded.expires_at,
             payment_order_id = excluded.payment_order_id,
             updated_by       = 'bisnap_webhook',
             updated_at       = now()`,
          [order.user_id, order.plan, order.billing_cycle, order.amount, months, orderId]
        );

        console.log(`[bisnap-webhook] Activated ${order.plan}/${order.billing_cycle} for user ${order.user_id}`);
      }
    } else if (status === "02" || status === "pending") {
      await query(
        `update payment_orders set status = 'pending', updated_at = now() where order_id = $1`,
        [orderId]
      );
    } else {
      // Any other status (expired, failed, cancelled, etc.)
      await query(
        `update payment_orders set status = 'failed', updated_at = now() where order_id = $1`,
        [orderId]
      );
    }
  } catch (err) {
    console.error("[bisnap-webhook] DB error:", err);
    // Return 200 to Midtrans to avoid retries for DB errors we handle via logs
  }

  // BI SNAP spec requires 2xx response with specific body
  return NextResponse.json({
    responseCode:    "2000000",
    responseMessage: "Success",
    referenceNo:     notification.referenceNo ?? "",
    partnerReferenceNo: orderId,
  });
}
