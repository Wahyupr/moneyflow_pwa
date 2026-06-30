/**
 * POST /api/payments/sync
 *
 * Pulls the current transaction status from Midtrans API by order_id
 * and updates the local DB. This is a client-initiated fallback for
 * cases where the Midtrans webhook cannot reach the server (e.g. localhost,
 * tunnel down, or missed webhook).
 *
 * Body: { order_id: string }
 * Auth: requires logged-in user (ownership is verified).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

type MidtransStatusResponse = {
  order_id:           string;
  transaction_id:     string;
  transaction_status: string;
  fraud_status?:      string;
  payment_type:       string;
  status_code:        string;
  gross_amount:       string;
};

/** Same logic as webhook handler */
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
  return null; // pending / authorize
}

/** How long a paid subscription is valid from now. */
function periodEnd(billing: string): Date {
  const now = new Date();
  if (billing === "yearly") {
    return new Date(now.setFullYear(now.getFullYear() + 1));
  }
  return new Date(now.setMonth(now.getMonth() + 1));
}

/**
 * Fetches transaction status directly from Midtrans Status API.
 * Uses Basic Auth: base64(serverKey + ":").
 * Docs: https://api-docs.midtrans.com/#get-status
 */
async function fetchMidtransStatus(orderId: string): Promise<MidtransStatusResponse> {
  const serverKey = process.env.MIDTRANS_SERVER_KEY ?? "";
  if (!serverKey) throw new Error("MIDTRANS_SERVER_KEY not configured.");

  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const baseUrl = isProduction
    ? "https://api.midtrans.com/v2"
    : "https://api.sandbox.midtrans.com/v2";

  const credentials = Buffer.from(`${serverKey}:`).toString("base64");

  const res = await fetch(`${baseUrl}/${encodeURIComponent(orderId)}/status`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
      "Authorization": `Basic ${credentials}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Midtrans status check failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<MidtransStatusResponse>;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  let body: { order_id?: unknown };
  try {
    body = await request.json() as { order_id?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const orderId = typeof body.order_id === "string" ? body.order_id.trim() : null;
  if (!orderId) {
    return NextResponse.json({ error: "order_id is required." }, { status: 400 });
  }

  // 1. Load order from DB — verify it belongs to the requesting user
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
    [orderId]
  );

  const order = orderResult.rows[0];
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (order.user_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // 2. Already finalised — return current status immediately
  if (order.status !== "pending") {
    return NextResponse.json({ status: order.status, changed: false });
  }

  // 3. Query Midtrans for current status
  let mtStatus: MidtransStatusResponse;
  try {
    mtStatus = await fetchMidtransStatus(orderId);
  } catch (err) {
    console.error("[payments/sync] Midtrans status check failed:", err);
    return NextResponse.json(
      { error: "Failed to check status from Midtrans. Try again shortly." },
      { status: 502 }
    );
  }

  const newStatus = resolveStatus(mtStatus.transaction_status, mtStatus.fraud_status);
  if (!newStatus) {
    // Still pending on Midtrans side
    return NextResponse.json({ status: "pending", changed: false });
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
    [newStatus, mtStatus.transaction_id, mtStatus.payment_type, JSON.stringify(mtStatus), order.id]
  );

  // 5. If paid, activate the subscription
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
      [order.user_id, order.plan, endDate.toISOString(), order.id, mtStatus.payment_type]
    );

    console.info(
      `[payments/sync] Activated ${order.plan}/${order.billing_cycle} for user ${order.user_id}`
    );
  }

  return NextResponse.json({ status: newStatus, changed: true });
}
