/**
 * POST /api/payments/webhook
 *
 * Receives Midtrans payment notifications (server-to-server).
 * This route must be public (no auth cookie required).
 * Registered in Midtrans dashboard as the "Payment Notification URL".
 *
 * Security: every request is verified with SHA-512 signature before
 * any DB mutation is made.
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/pool";
import { verifyMidtransSignature } from "@/lib/midtrans";

type MidtransNotification = {
  order_id:           string;
  transaction_id:     string;
  transaction_status: string;
  fraud_status?:      string;
  payment_type:       string;
  status_code:        string;
  gross_amount:       string;
  signature_key:      string;
};

/** Maps Midtrans transaction_status to our internal status. */
function resolveStatus(
  transactionStatus: string,
  fraudStatus: string | undefined
): "paid" | "failed" | "expired" | null {
  if (transactionStatus === "capture") {
    return fraudStatus === "accept" ? "paid" : "failed";
  }
  if (transactionStatus === "settlement") return "paid";
  if (transactionStatus === "cancel" || transactionStatus === "deny") return "failed";
  if (transactionStatus === "expire") return "expired";
  // pending / authorize — no DB change yet
  return null;
}

/** How long a paid subscription is valid from now. */
function periodEnd(billing: string): Date {
  const now = new Date();
  if (billing === "yearly") {
    return new Date(now.setFullYear(now.getFullYear() + 1));
  }
  return new Date(now.setMonth(now.getMonth() + 1));
}

export async function POST(request: NextRequest) {
  let body: MidtransNotification;
  try {
    body = await request.json() as MidtransNotification;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // 1. Verify signature before touching the DB
  const valid = verifyMidtransSignature({
    orderId:      body.order_id,
    statusCode:   body.status_code,
    grossAmount:  body.gross_amount,
    signatureKey: body.signature_key,
  });

  if (!valid) {
    console.warn("[payments/webhook] Invalid Midtrans signature for order:", body.order_id);
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  // 2. Load our payment order
  const orderResult = await query<{
    id: string;
    user_id: string;
    plan: string;
    billing_cycle: string;
    status: string;
  }>(
    `select id, user_id, plan, billing_cycle, status
     from payment_orders
     where order_id = $1
     limit 1`,
    [body.order_id]
  );

  const order = orderResult.rows[0];
  if (!order) {
    // Unknown order — return 200 so Midtrans doesn't retry
    console.warn("[payments/webhook] Unknown order_id:", body.order_id);
    return NextResponse.json({ ok: true });
  }

  // 3. Idempotency: skip if already processed
  if (order.status === "paid") {
    return NextResponse.json({ ok: true });
  }

  const newStatus = resolveStatus(body.transaction_status, body.fraud_status);
  if (!newStatus) {
    // Pending/authorize — nothing to do yet
    return NextResponse.json({ ok: true });
  }

  // 4. Update payment_orders
  await query(
    `update payment_orders
     set status                  = $1,
         midtrans_transaction_id = $2,
         payment_method          = $3,
         midtrans_raw            = $4,
         paid_at                 = case when $1 = 'paid' then now() else null end,
         expired_at              = case when $1 = 'expired' then now() else null end
     where id = $5`,
    [newStatus, body.transaction_id, body.payment_type, JSON.stringify(body), order.id]
  );

  // 5. If paid, activate/extend the subscription
  if (newStatus === "paid") {
    const endDate = periodEnd(order.billing_cycle);

    await query(
      `insert into subscription_entitlements
         (user_id, plan, status, current_period_end, last_payment_order_id, payment_method)
       values ($1, $2, 'active', $3, $4, $5)
       on conflict (user_id) do update
         set plan                   = excluded.plan,
             status                 = 'active',
             current_period_end     = excluded.current_period_end,
             last_payment_order_id  = excluded.last_payment_order_id,
             payment_method         = excluded.payment_method`,
      [order.user_id, order.plan, endDate.toISOString(), order.id, body.payment_type]
    );

    console.info(
      `[payments/webhook] Activated ${order.plan}/${order.billing_cycle} for user ${order.user_id}`
    );
  }

  return NextResponse.json({ ok: true });
}
