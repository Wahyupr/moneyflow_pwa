import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

/** GET /api/chat/sessions/[id] — load messages for one session (owner only). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;

  try {
    const owns = await query<{ id: string }>(
      `select id from chat_sessions where id = $1 and user_id = $2`,
      [id, auth.user.id]
    );
    if (owns.rows.length === 0) {
      return NextResponse.json({ error: "Percakapan tidak ditemukan." }, { status: 404 });
    }

    const res = await query<{ id: string; role: string; content: string; created_at: string }>(
      `select id, role, content, created_at
       from chat_messages
       where session_id = $1 and user_id = $2
       order by created_at`,
      [id, auth.user.id]
    );
    return NextResponse.json({ messages: res.rows });
  } catch (err) {
    console.error("[chat/sessions/[id] GET]", err);
    return NextResponse.json({ error: "Gagal memuat percakapan." }, { status: 500 });
  }
}

/** DELETE /api/chat/sessions/[id] — remove a session and its messages. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;

  try {
    await query(`delete from chat_sessions where id = $1 and user_id = $2`, [id, auth.user.id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[chat/sessions/[id] DELETE]", err);
    return NextResponse.json({ error: "Gagal menghapus percakapan." }, { status: 500 });
  }
}
