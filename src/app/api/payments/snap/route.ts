import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";
import { createSnapToken } from "@/lib/midtrans";
import { getCheckoutAmount, type CurrentPlan } from "@/lib/pricing";

type Plan = "premium" | "pro";

/**
 * Reads the user's current active plan from the DB. An entitlement whose
 * period has lapsed counts as free (same rule the gating queries use). This is
 * the trusted basis for upgrade pricing — never trust a client-sent plan.
 */
async function getCurrentPlan(userId: string): Promise<CurrentPlan> {
  try {
    const res = await query<{ plan: string }>(
      `select plan from subscription_entitlements
       where user_id = $1 and status = 'active'
         and (current_period_end is null or current_period_end > now())
       limit 1`,
      [userId]
    );
    const plan = res.rows[0]?.plan;
    if (plan === "premium" || plan === "pro") return plan;
    return "free";
  } catch {
    return "free";
  }
}

function getItemLabel(plan: Plan): string {
  const planName = plan === "premium" ? "Premium" : "Pro";
  return `MoneyFlow ${planName} (Bulanan)`;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  let body: { plan?: unknown };
  try {
    body = await request.json() as { plan?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const plan = body.plan as Plan;

  if (!["premium", "pro"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan. Must be 'premium' or 'pro'." }, { status: 400 });
  }

  // Compute amount server-side from the DB-verified current plan.
  const currentPlan = await getCurrentPlan(auth.user.id);
  const amount   = getCheckoutAmount(plan, currentPlan);
  const orderId  = `MF-${crypto.randomUUID()}`;
  const itemName = getItemLabel(plan);

  // Persist the pending order first so we have a record even if Snap API fails
  try {
    await query(
      `insert into payment_orders
         (user_id, order_id, plan, billing_cycle, amount, status)
       values ($1, $2, $3, 'monthly', $4, 'pending')`,
      [auth.user.id, orderId, plan, amount]
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
      itemId: `${plan}-monthly`,
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
