import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";
import { createSnapToken } from "@/lib/midtrans";
import { PRICES } from "@/components/landing/pricing";

type Plan = "premium" | "pro";
type BillingCycle = "monthly" | "yearly";

function getAmount(plan: Plan, billing: BillingCycle): number {
  if (billing === "yearly") {
    // Charge full year upfront
    return PRICES[plan].yearly_per_month * 12;
  }
  return PRICES[plan].monthly;
}

function getItemLabel(plan: Plan, billing: BillingCycle): string {
  const planName = plan === "premium" ? "Premium" : "Pro";
  const period   = billing === "yearly" ? "Tahunan" : "Bulanan";
  return `MoneyFlow ${planName} (${period})`;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  let body: { plan?: unknown; billing?: unknown };
  try {
    body = await request.json() as { plan?: unknown; billing?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const plan    = body.plan as Plan;
  const billing = (body.billing ?? "monthly") as BillingCycle;

  if (!["premium", "pro"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan. Must be 'premium' or 'pro'." }, { status: 400 });
  }
  if (!["monthly", "yearly"].includes(billing)) {
    return NextResponse.json({ error: "Invalid billing cycle." }, { status: 400 });
  }

  const amount   = getAmount(plan, billing);
  const orderId  = `MF-${crypto.randomUUID()}`;
  const itemName = getItemLabel(plan, billing);

  // Persist the pending order first so we have a record even if Snap API fails
  try {
    await query(
      `insert into payment_orders
         (user_id, order_id, plan, billing_cycle, amount, status)
       values ($1, $2, $3, $4, $5, 'pending')`,
      [auth.user.id, orderId, plan, billing, amount]
    );
  } catch (err) {
    console.error("[payments/snap] DB insert failed:", err);
    return NextResponse.json({ error: "Failed to create order." }, { status: 500 });
  }

  // Fetch display name from profiles table (not user_metadata which is Supabase-specific)
  let displayName = auth.user.email.split("@")[0];
  try {
    const profileRow = await query<{ display_name: string | null }>(
      `select display_name from profiles where id = $1`,
      [auth.user.id]
    );
    if (profileRow.rows[0]?.display_name) {
      displayName = profileRow.rows[0].display_name;
    }
  } catch {
    // Non-fatal: fall back to email prefix
  }

  let snapResult: { token: string; redirectUrl: string };
  try {
    snapResult = await createSnapToken({
      orderId,
      amount,
      customerName: displayName,
      customerEmail: auth.user.email,
      itemId: `${plan}-${billing}`,
      itemName,
    });
  } catch (err) {
    console.error("[payments/snap] Midtrans Snap API failed:", err);
    // Mark order as failed so it doesn't litter the DB as phantom pending
    await query(
      `update payment_orders set status = 'failed' where order_id = $1`,
      [orderId]
    ).catch(() => void 0);
    return NextResponse.json({ error: "Failed to create Snap token. Check MIDTRANS_SERVER_KEY." }, { status: 502 });
  }

  // Save Snap token for reference / debugging
  await query(
    `update payment_orders set snap_token = $1 where order_id = $2`,
    [snapResult.token, orderId]
  ).catch(() => void 0);

  return NextResponse.json({
    snapToken:   snapResult.token,
    redirectUrl: snapResult.redirectUrl,
    orderId,
  });
}
