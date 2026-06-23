/**
 * POST  /api/notifications/subscribe  – save a Web Push subscription for the
 *                                       authenticated user's current device.
 * DELETE /api/notifications/subscribe – remove it.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  })
});

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const parsed = SubscribeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Subscription tidak valid." }, { status: 400 });
  }
  const { endpoint, keys } = parsed.data;

  await query(
    `insert into push_subscriptions (user_id, endpoint, p256dh, auth)
     values ($1, $2, $3, $4)
     on conflict (user_id, endpoint) do update
       set p256dh = excluded.p256dh,
           auth   = excluded.auth`,
    [auth.user.id, endpoint, keys.p256dh, keys.auth]
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => ({})) as { endpoint?: string };
  if (!body.endpoint) {
    return NextResponse.json({ error: "endpoint diperlukan." }, { status: 400 });
  }

  await query(
    "delete from push_subscriptions where user_id = $1 and endpoint = $2",
    [auth.user.id, body.endpoint]
  );

  return NextResponse.json({ ok: true });
}
