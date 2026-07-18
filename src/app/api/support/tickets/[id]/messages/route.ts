import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";
import { sendNewReplyNotification } from "@/lib/email/resend";

export const runtime = "nodejs";

const CreateMessageSchema = z.object({
  body: z.string().min(1).max(5000),
  attachment_url: z.string().url().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id: ticketId } = await params;
  const parsed = CreateMessageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Pesan tidak valid." }, { status: 400 });
  }

  const isStaff = auth.user.role === "admin" || auth.user.role === "cs";

  try {
    const ticketResult = await query<{
      id: string;
      user_id: string;
      subject: string;
      status: string;
    }>(
      `select id, user_id, subject, status from support_tickets where id = $1`,
      [ticketId]
    );

    const ticket = ticketResult.rows[0];
    if (!ticket) {
      return NextResponse.json({ error: "Tiket tidak ditemukan." }, { status: 404 });
    }

    if (!isStaff && ticket.user_id !== auth.user.id) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    if (ticket.status === "closed") {
      return NextResponse.json({ error: "Tiket sudah ditutup." }, { status: 409 });
    }

    const msgResult = await query<{
      id: string;
      sender_id: string;
      body: string;
      attachment_url: string | null;
      created_at: string;
    }>(
      `insert into support_messages (ticket_id, sender_id, body, attachment_url)
       values ($1, $2, $3, $4)
       returning id, sender_id, body, attachment_url, created_at`,
      [ticketId, auth.user.id, parsed.data.body, parsed.data.attachment_url ?? null]
    );

    // Update timestamp tiket supaya muncul di atas di list
    await query(`update support_tickets set updated_at = now() where id = $1`, [ticketId]);

    // Kirim notifikasi ke pihak lain:
    // Jika staff reply → kirim ke user pemilik tiket
    // Jika user reply → kirim ke semua CS + admin
    const senderDisplayName = auth.user.user_metadata.display_name ?? auth.user.email;

    if (isStaff) {
      const ownerResult = await query<{ email: string }>(
        `select email from users where id = $1`,
        [ticket.user_id]
      );
      if (ownerResult.rows[0]) {
        await sendNewReplyNotification({
          to: ownerResult.rows[0].email,
          ticketId,
          ticketSubject: ticket.subject,
          replierName: senderDisplayName,
          isStaff: true,
        }).catch(() => null);
      }
    } else {
      const staffResult = await query<{ email: string }>(
        `select email from users where role in ('admin', 'cs')`
      );
      await Promise.allSettled(
        staffResult.rows.map((staff) =>
          sendNewReplyNotification({
            to: staff.email,
            ticketId,
            ticketSubject: ticket.subject,
            replierName: senderDisplayName,
            isStaff: false,
          })
        )
      );
    }

    return NextResponse.json({ message: msgResult.rows[0] }, { status: 201 });
  } catch (err) {
    console.error("[support/tickets/[id]/messages POST]", err);
    return NextResponse.json({ error: "Gagal mengirim pesan." }, { status: 500 });
  }
}
