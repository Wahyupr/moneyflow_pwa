/**
 * GET  /api/notifications/logs         – last 50 push notifications for the user
 * POST /api/notifications/logs/read    – mark all as read (handled in /read/route.ts)
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

type LogRow = {
  id: string;
  title: string;
  body: string;
  url: string;
  read_at: string | null;
  sent_at: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { rows } = await query<LogRow>(
    `select id, title, body, url, read_at, sent_at
     from notification_logs
     where user_id = $1
     order by sent_at desc
     limit 50`,
    [auth.user.id]
  );

  const unread = rows.filter((r) => !r.read_at).length;

  return NextResponse.json({ logs: rows, unread });
}
