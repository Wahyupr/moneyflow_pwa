import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";
import { sendNewTicketNotification } from "@/lib/email/resend";

export const runtime = "nodejs";

const CreateTicketSchema = z.object({
  subject: z.string().min(3).max(200),
  body: z.string().min(1).max(5000),
  attachment_url: z.string().url().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const isStaff = auth.user.role === "admin" || auth.user.role === "cs";

  try {
    if (isStaff) {
      const result = await query<{
        id: string;
        user_id: string;
        user_email: string;
        subject: string;
        status: string;
        created_at: string;
        updated_at: string;
        message_count: string;
      }>(
        `select t.id, t.user_id, u.email as user_email, t.subject, t.status,
                t.created_at, t.updated_at,
                count(m.id)::text as message_count
         from support_tickets t
         join users u on u.id = t.user_id
         left join support_messages m on m.ticket_id = t.id
         group by t.id, u.email
         order by t.updated_at desc`
      );
      return NextResponse.json({ tickets: result.rows });
    }

    const result = await query<{
      id: string;
      subject: string;
      status: string;
      created_at: string;
      updated_at: string;
      message_count: string;
      queue_number: number | null;
    }>(
      `select t.id, t.subject, t.status, t.created_at, t.updated_at,
              t.queue_number,
              count(m.id)::text as message_count
       from support_tickets t
       left join support_messages m on m.ticket_id = t.id
       where t.user_id = $1
       group by t.id
       order by t.updated_at desc`,
      [auth.user.id]
    );
    return NextResponse.json({ tickets: result.rows });
  } catch (err) {
    console.error("[support/tickets GET]", err);
    return NextResponse.json({ error: "Gagal mengambil tiket." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const parsed = CreateTicketSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  try {
    const ticketResult = await query<{ id: string; subject: string; status: string; created_at: string }>(
      `insert into support_tickets (user_id, subject)
       values ($1, $2)
       returning id, subject, status, created_at`,
      [auth.user.id, parsed.data.subject]
    );
    const ticket = ticketResult.rows[0];

    await query(
      `insert into support_messages (ticket_id, sender_id, body, attachment_url)
       values ($1, $2, $3, $4)`,
      [ticket.id, auth.user.id, parsed.data.body, parsed.data.attachment_url ?? null]
    );

    // Kirim email notifikasi ke semua CS dan admin
    const staffResult = await query<{ email: string }>(
      `select email from users where role in ('admin', 'cs')`
    );

    await Promise.allSettled(
      staffResult.rows.map((staff) =>
        sendNewTicketNotification({
          to: staff.email,
          ticketId: ticket.id,
          ticketSubject: ticket.subject,
          userEmail: auth.user.email,
        })
      )
    );

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    console.error("[support/tickets POST]", err);
    return NextResponse.json({ error: "Gagal membuat tiket." }, { status: 500 });
  }
}
