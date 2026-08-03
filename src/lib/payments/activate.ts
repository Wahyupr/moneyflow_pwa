import { query } from "@/lib/db/pool";

type ActivateInput = {
  userId: string;
  plan: string;          // 'premium' | 'pro'
  orderId: string;       // payment_orders.id (uuid)
  paymentMethod: string | null;
};

/**
 * Computes the entitlement period end when activating a paid plan.
 *
 * Business rule: if the user already has an entitlement whose period is still
 * in the future (an active trial, or a paid plan mid-cycle), an upgrade keeps
 * that existing end date — e.g. a 7-day Premium trial upgrading to Pro stays
 * Pro only for the remaining trial days, and a paid Premium upgrading to Pro
 * finishes the current billing period as Pro. A fresh purchase (no active
 * period) gets a full month from now.
 */
function computePeriodEnd(existingEnd: string | null): string {
  const now = Date.now();
  if (existingEnd) {
    const existing = new Date(existingEnd).getTime();
    if (!Number.isNaN(existing) && existing > now) {
      return new Date(existing).toISOString();
    }
  }
  const oneMonth = new Date();
  oneMonth.setMonth(oneMonth.getMonth() + 1);
  return oneMonth.toISOString();
}

/**
 * Activates (or upgrades) a user's subscription after a confirmed payment.
 * Shared by the Midtrans webhook and the client-initiated sync route so both
 * paths apply identical period + upgrade logic.
 */
export async function activateSubscription(input: ActivateInput): Promise<void> {
  const existing = await query<{ current_period_end: string | null }>(
    `select current_period_end from subscription_entitlements
     where user_id = $1 and status = 'active'
       and (current_period_end is null or current_period_end > now())
     limit 1`,
    [input.userId]
  );

  const periodEnd = computePeriodEnd(existing.rows[0]?.current_period_end ?? null);

  await query(
    `insert into subscription_entitlements
       (user_id, plan, status, current_period_end, last_payment_order_id, payment_method)
     values ($1, $2, 'active', $3, $4, $5)
     on conflict (user_id) do update
       set plan                  = excluded.plan,
           status                = 'active',
           current_period_end    = excluded.current_period_end,
           last_payment_order_id = excluded.last_payment_order_id,
           payment_method        = excluded.payment_method`,
    [input.userId, input.plan, periodEnd, input.orderId, input.paymentMethod]
  );
}
