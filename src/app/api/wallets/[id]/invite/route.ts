import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";
import { sendWalletInviteEmail } from "@/lib/email/resend";
import { getAuthRedirectUrl } from "@/lib/app-config";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id: walletId } = await context.params;

  // Verify caller owns this wallet
  const walletResult = await query<{ id: string; name: string; user_id: string }>(
    "select id, name, user_id from wallets where id = $1 and user_id = $2 and archived_at is null",
    [walletId, auth.user.id]
  );
  const wallet = walletResult.rows[0];
  if (!wallet) {
    return NextResponse.json({ error: "Dompet tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const inviteeEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!inviteeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteeEmail)) {
    return NextResponse.json({ error: "Email tidak valid." }, { status: 400 });
  }

  // Cannot invite yourself
  if (inviteeEmail === auth.user.email.toLowerCase()) {
    return NextResponse.json({ error: "Tidak bisa mengundang diri sendiri." }, { status: 400 });
  }

  // Check if already a member
  const memberCheck = await query(
    `select wm.id from wallet_members wm
     join users u on u.id = wm.user_id
     where wm.wallet_id = $1 and lower(u.email) = $2`,
    [walletId, inviteeEmail]
  );
  if ((memberCheck.rows.length ?? 0) > 0) {
    return NextResponse.json({ error: "Pengguna ini sudah menjadi anggota dompet." }, { status: 409 });
  }

  // Invalidate any previous pending invite for this wallet+email
  await query(
    "delete from wallet_invites where wallet_id = $1 and lower(invitee_email) = $2 and accepted_at is null",
    [walletId, inviteeEmail]
  );

  // Create new invite token (32 random bytes → 64-char hex)
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await query(
    `insert into wallet_invites (wallet_id, invited_by, invitee_email, token, role, expires_at)
     values ($1, $2, $3, $4, 'member', $5)`,
    [walletId, auth.user.id, inviteeEmail, token, expiresAt]
  );

  // Mark wallet as shared
  await query("update wallets set is_shared = true where id = $1", [walletId]);

  const inviteUrl = getAuthRedirectUrl(`/wallets/join?token=${token}`);
  const inviterName = auth.user.user_metadata.display_name || auth.user.email;

  try {
    await sendWalletInviteEmail({
      to: inviteeEmail,
      inviterName,
      walletName: wallet.name,
      inviteUrl
    });
  } catch (err) {
    // Log but don't fail — invite row is already created
    console.error("Failed to send wallet invite email:", err);
    return NextResponse.json(
      { ok: true, warning: "Undangan dibuat, tapi email gagal dikirim. Salin link undangan secara manual.", inviteUrl },
      { status: 201 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
