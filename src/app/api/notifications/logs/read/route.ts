/**
 * POST /api/notifications/logs/read
 * Marks all unread notification logs as read for the authenticated user.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  await query(
    "update notification_logs set read_at = now() where user_id = $1 and read_at is null",
    [auth.user.id]
  );

  return NextResponse.json({ ok: true });
}
