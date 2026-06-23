/**
 * Web Push helpers.
 *
 * VAPID keys are read from env vars:
 *   VAPID_PUBLIC_KEY   – also exposed as NEXT_PUBLIC_VAPID_PUBLIC_KEY to the browser
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT      – mailto: or https: contact URL, e.g. "mailto:admin@example.com"
 *
 * Generate a fresh key pair once with:
 *   node -e "const wp=require('web-push'); const k=wp.generateVAPIDKeys(); console.log(k)"
 */
import webpush from "web-push";

let initialised = false;

function init() {
  if (initialised) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@moneyflow.app";

  if (!pub || !priv) {
    throw new Error("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set.");
  }

  webpush.setVapidDetails(subject, pub, priv);
  initialised = true;
}

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Send a notification to a single subscription. Returns `true` on success,
 * `false` when the subscription is expired/invalid (410/404 — caller should
 * delete it), throws on other errors.
 */
export async function sendPushNotification(
  sub: PushSubscriptionRecord,
  payload: { title: string; body: string; url?: string }
): Promise<boolean> {
  init();
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      },
      JSON.stringify(payload),
      { TTL: 86_400 } // 24 h
    );
    return true;
  } catch (err: unknown) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 410 || status === 404) {
      return false; // subscription expired — delete it
    }
    throw err;
  }
}
