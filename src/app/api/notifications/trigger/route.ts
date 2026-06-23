/**
 * POST /api/notifications/trigger
 *
 * Finds all active reminders whose due-date falls exactly `remind_days_before`
 * days from today (in UTC), then sends a Web Push notification to every
 * subscribed device of the rule's owner.
 *
 * Secured by a static bearer token (CRON_SECRET env var) so it can safely be
 * called by an external cron job (Railway cron, Vercel cron, uptime-kuma, etc.)
 * without exposing user data.
 *
 * Manual test:
 *   curl -X POST https://your-app/api/notifications/trigger \
 *        -H "Authorization: Bearer <CRON_SECRET>"
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { query } from "@/lib/db/pool";
import { sendPushNotification, type PushSubscriptionRecord } from "@/lib/push";
import { formatCurrency } from "@/lib/money";

export const runtime = "nodejs";

type ReminderDue = {
  user_id: string;
  name: string | null;
  amount_minor: string;
  currency: string;
  days_until: number;
};

type SubRow = PushSubscriptionRecord & { id: string };

export async function POST(request: NextRequest) {
  // ── Auth: CRON_SECRET bearer token ──────────────────────────────────────
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  // ── Query reminders due within their remind_days_before window ───────────
  // We compare next_run_at (date part in UTC) against today + remind_days_before.
  const { rows: dueReminders } = await query<ReminderDue>(
    `select
       r.user_id,
       r.name,
       r.amount_minor::text,
       r.currency,
       extract(epoch from (
         date_trunc('day', r.next_run_at at time zone 'UTC')
         - date_trunc('day', now() at time zone 'UTC')
       ))::int / 86400 as days_until
     from recurring_rules r
     where r.is_active = true
       and extract(epoch from (
             date_trunc('day', r.next_run_at at time zone 'UTC')
             - date_trunc('day', now() at time zone 'UTC')
           ))::int / 86400 = r.remind_days_before`
  );

  if (dueReminders.length === 0) {
    return NextResponse.json({ sent: 0, message: "Tidak ada reminder yang jatuh tempo hari ini." });
  }

  // Group by user_id to batch subscription lookups
  const userIds = [...new Set(dueReminders.map((r) => r.user_id))];

  const { rows: subscriptions } = await query<SubRow & { user_id: string }>(
    `select id, user_id, endpoint, p256dh, auth
     from push_subscriptions
     where user_id = any($1)`,
    [userIds]
  );

  const subsByUser = new Map<string, (SubRow & { user_id: string })[]>();
  for (const sub of subscriptions) {
    const list = subsByUser.get(sub.user_id) ?? [];
    list.push(sub);
    subsByUser.set(sub.user_id, list);
  }

  let sent = 0;
  const staleIds: string[] = [];

  for (const reminder of dueReminders) {
    const subs = subsByUser.get(reminder.user_id) ?? [];
    const amount = formatCurrency(Number(reminder.amount_minor), "IDR");
    const name = reminder.name ?? "Tagihan";

    let title: string;
    let body: string;
    if (reminder.days_until === 0) {
      title = `🔔 ${name} jatuh tempo hari ini`;
      body = `Sebesar ${amount} perlu dibayar sekarang.`;
    } else {
      title = `⏰ ${name} jatuh tempo ${reminder.days_until} hari lagi`;
      body = `Persiapkan ${amount} sebelum tenggat.`;
    }

    for (const sub of subs) {
      const ok = await sendPushNotification(sub, {
        title,
        body,
        url: "/reminders"
      });
      if (ok) {
        sent++;
      } else {
        staleIds.push(sub.id);
      }
    }

    // Log every successfully sent notification so users can view history
    if (subs.length > 0) {
      await query(
        `insert into notification_logs (user_id, title, body, url)
         values ($1, $2, $3, $4)`,
        [reminder.user_id, title, body, "/reminders"]
      );
    }
  }

  // Clean up expired subscriptions
  if (staleIds.length > 0) {
    await query(
      "delete from push_subscriptions where id = any($1)",
      [staleIds]
    );
  }

  return NextResponse.json({ sent, stale_removed: staleIds.length });
}
