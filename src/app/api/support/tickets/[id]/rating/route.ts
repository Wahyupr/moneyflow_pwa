import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const RatingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  rating_comment: z.string().max(1000).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const parsed = RatingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Rating tidak valid (harus 1–5)." }, { status: 400 });
  }

  try {
    const ticketResult = await query<{ id: string; user_id: string; status: string; rating: number | null }>(
      `select id, user_id, status, rating from support_tickets where id = $1`,
      [id]
    );

    const ticket = ticketResult.rows[0];
    if (!ticket) {
      return NextResponse.json({ error: "Tiket tidak ditemukan." }, { status: 404 });
    }

    if (ticket.user_id !== auth.user.id) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    if (ticket.status !== "resolved") {
      return NextResponse.json({ error: "Rating hanya bisa diberikan pada tiket yang sudah selesai." }, { status: 409 });
    }

    if (ticket.rating !== null) {
      return NextResponse.json({ error: "Rating sudah pernah diberikan." }, { status: 409 });
    }

    await query(
      `update support_tickets
       set rating = $1, rating_comment = $2, updated_at = now()
       where id = $3`,
      [parsed.data.rating, parsed.data.rating_comment ?? null, id]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[support/tickets/[id]/rating PATCH]", err);
    return NextResponse.json({ error: "Gagal menyimpan rating." }, { status: 500 });
  }
}
