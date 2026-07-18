import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const UpdateStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const isStaff = auth.user.role === "admin" || auth.user.role === "cs";

  try {
    const ticketResult = await query<{
      id: string;
      user_id: string;
      user_email: string;
      subject: string;
      status: string;
      category: string;
      rating: number | null;
      rating_comment: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `select t.id, t.user_id, u.email as user_email, t.subject, t.status,
              t.category, t.rating, t.rating_comment, t.created_at, t.updated_at
       from support_tickets t
       join users u on u.id = t.user_id
       where t.id = $1`,
      [id]
    );

    const ticket = ticketResult.rows[0];
    if (!ticket) {
      return NextResponse.json({ error: "Tiket tidak ditemukan." }, { status: 404 });
    }

    if (!isStaff && ticket.user_id !== auth.user.id) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    const messagesResult = await query<{
      id: string;
      sender_id: string;
      sender_email: string;
      sender_display_name: string | null;
      sender_role: string;
      body: string;
      attachment_url: string | null;
      created_at: string;
    }>(
      `select m.id, m.sender_id, u.email as sender_email,
              u.display_name as sender_display_name, u.role as sender_role,
              m.body, m.attachment_url, m.created_at
       from support_messages m
       join users u on u.id = m.sender_id
       where m.ticket_id = $1
       order by m.created_at asc`,
      [id]
    );

    return NextResponse.json({ ticket, messages: messagesResult.rows });
  } catch (err) {
    console.error("[support/tickets/[id] GET]", err);
    return NextResponse.json({ error: "Gagal mengambil tiket." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  if (auth.user.role !== "admin" && auth.user.role !== "cs") {
    return NextResponse.json({ error: "CS atau admin access diperlukan." }, { status: 403 });
  }

  const { id } = await params;
  const parsed = UpdateStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Status tidak valid." }, { status: 400 });
  }

  try {
    const result = await query<{ id: string; status: string; updated_at: string }>(
      `update support_tickets
       set status = $1, updated_at = now()
       where id = $2
       returning id, status, updated_at`,
      [parsed.data.status, id]
    );

    if (!result.rows[0]) {
      return NextResponse.json({ error: "Tiket tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ ticket: result.rows[0] });
  } catch (err) {
    console.error("[support/tickets/[id] PATCH]", err);
    return NextResponse.json({ error: "Gagal update status tiket." }, { status: 500 });
  }
}
