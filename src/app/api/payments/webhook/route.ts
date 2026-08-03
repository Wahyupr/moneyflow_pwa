import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db/pool";
import { verifyNotification } from "@/lib/midtrans";
import { activateSubscription } from "@/lib/payments/activate";

export const runtime = "nodejs";

function resolveStatus(
  transactionStatus: string,
  fraudStatus: string | undefined
): "paid" | "failed" | "expired" | null {
  if (transactionStatus === "capture") return fraudStatus === "accept" ? "paid" : "failed";
  if (transactionStatus === "settlement") return "paid";
  if (transactionStatus === "cancel" || transactionStatus === "deny") return "failed";
  if (transactionStatus === "expire") return "expired";
  return null;
}

async function processWebhook(request: NextRequest) {
  const body = await request.json();
  const notification = await verifyNotification(body);

  const orderResult = await query<{ id: string; user_id: string; plan: string; billing_cycle: string; status: string }>(
    `select id, user_id, plan, billing_cycle, status from payment_orders where order_id = $1 limit 1`,
    [notification.order_id]
  );
  const order = orderResult.rows[0];

  if (!order) {
    console.warn(`[payments/webhook] Unknown order_id: ${notification.order_id}`);
    return;
  }
  if (order.status === "paid") return;

  const newStatus = resolveStatus(notification.transaction_status, notification.fraud_status);
  if (!newStatus) return;

  await query(
    `update payment_orders set status = $1::payment_order_status, midtrans_transaction_id = $2, payment_method = $3, midtrans_raw = $4, paid_at = case when $1::payment_order_status = 'paid' then now() else paid_at end, expired_at = case when $1::payment_order_status = 'expired' then now() else expired_at end where id = $5`,
    [newStatus, notification.transaction_id, notification.payment_type, JSON.stringify(notification), order.id]
  );

  if (newStatus === "paid") {
    await activateSubscription({
      userId: order.user_id,
      plan: order.plan,
      orderId: order.id,
      paymentMethod: notification.payment_type,
    });
    console.info(`[payments/webhook] Activated ${order.plan}/${order.billing_cycle} for user ${order.user_id}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    await processWebhook(request);
  } catch (err) {
    const errorPayload = err instanceof Error ? { message: err.message, stack: err.stack } : { error: String(err) };
    console.error("[payments/webhook] Unhandled exception during processing", errorPayload);
  }
  return NextResponse.json({ ok: true });
}
