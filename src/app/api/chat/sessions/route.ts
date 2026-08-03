import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

/** GET /api/chat/sessions — list the user's chat sessions, newest first. */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  try {
    const res = await query<{ id: string; title: string; updated_at: string }>(
      `select id, title, updated_at
       from chat_sessions
       where user_id = $1
       order by updated_at desc
       limit 50`,
      [auth.user.id]
    );
    return NextResponse.json({ sessions: res.rows });
  } catch (err) {
    console.error("[chat/sessions GET]", err);
    return NextResponse.json({ sessions: [] });
  }
}

/** POST /api/chat/sessions — start a new chat session. */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  try {
    const res = await query<{ id: string; title: string; updated_at: string }>(
      `insert into chat_sessions (user_id) values ($1)
       returning id, title, updated_at`,
      [auth.user.id]
    );
    return NextResponse.json({ session: res.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[chat/sessions POST]", err);
    return NextResponse.json({ error: "Gagal membuat percakapan." }, { status: 500 });
  }
}
