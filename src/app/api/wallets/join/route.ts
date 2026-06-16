import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

/**
 * GET /api/wallets/join?token=xxx
 * Returns invite metadata so the confirmation page can display wallet name + inviter.
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.json({ error: "Token tidak ditemukan." }, { status: 400 });
  }

  const result = await query<{
    id: string;
    wallet_id: string;
    wallet_name: string;
    wallet_color: string;
    inviter_name: string;
    invitee_email: string;
    role: string;
    expires_at: string;
    accepted_at: string | null;
  }>(
    `select wi.id, wi.wallet_id, w.name as wallet_name, w.color as wallet_color,
            coalesce(u.display_name, u.email) as inviter_name,
            wi.invitee_email, wi.role, wi.expires_at, wi.accepted_at
     from wallet_invites wi
     join wallets w on w.id = wi.wallet_id
     join users u on u.id = wi.invited_by
     where wi.token = $1`,
    [token]
  );

  const invite = result.rows[0];
  if (!invite) {
    return NextResponse.json({ error: "Undangan tidak ditemukan atau sudah kadaluarsa." }, { status: 404 });
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: "Undangan ini sudah diterima sebelumnya." }, { status: 409 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Undangan sudah kadaluarsa." }, { status: 410 });
  }

  return NextResponse.json({ invite });
}

/**
 * POST /api/wallets/join
 * Body: { token: string }
 * Accepts a wallet invite — inserts into wallet_members and marks the invite accepted.
 */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token.trim() : "";

  if (!token) {
    return NextResponse.json({ error: "Token tidak ditemukan." }, { status: 400 });
  }

  const result = await query<{
    id: string;
    wallet_id: string;
    invited_by: string;
    invitee_email: string;
    role: string;
    expires_at: string;
    accepted_at: string | null;
  }>(
    `select id, wallet_id, invited_by, invitee_email, role, expires_at, accepted_at
     from wallet_invites where token = $1`,
    [token]
  );

  const invite = result.rows[0];
  if (!invite) {
    return NextResponse.json({ error: "Undangan tidak ditemukan." }, { status: 404 });
  }

  if (invite.accepted_at) {
    return NextResponse.json({ error: "Undangan ini sudah diterima sebelumnya." }, { status: 409 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Undangan sudah kadaluarsa." }, { status: 410 });
  }

  // The invite email doesn't have to match perfectly (user may have multiple
  // emails), but prevent the owner from accepting their own invite.
  if (invite.invited_by === auth.user.id) {
    return NextResponse.json({ error: "Pemilik dompet tidak bisa menerima undangan sendiri." }, { status: 400 });
  }

  // Check if already a member
  const memberCheck = await query(
    "select id from wallet_members where wallet_id = $1 and user_id = $2",
    [invite.wallet_id, auth.user.id]
  );
  if ((memberCheck.rows.length ?? 0) > 0) {
    return NextResponse.json({ error: "Kamu sudah menjadi anggota dompet ini." }, { status: 409 });
  }

  // Insert member + mark invite accepted in a single transaction
  await query("begin", []);
  try {
    await query(
      `insert into wallet_members (wallet_id, user_id, role, notify_on_transaction)
       values ($1, $2, $3, true)`,
      [invite.wallet_id, auth.user.id, invite.role]
    );
    await query(
      "update wallet_invites set accepted_at = now() where id = $1",
      [invite.id]
    );
    await query("update wallets set is_shared = true where id = $1", [invite.wallet_id]);
    await query("commit", []);
  } catch (err) {
    await query("rollback", []);
    console.error("Failed to accept wallet invite:", err);
    return NextResponse.json({ error: "Gagal menerima undangan." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, wallet_id: invite.wallet_id });
}
