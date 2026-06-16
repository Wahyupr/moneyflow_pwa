import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; userId: string }> };

/**
 * DELETE /api/wallets/[id]/members/[userId]
 * Owner can remove any member. A member can remove themselves (leave).
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id: walletId, userId: targetUserId } = await context.params;

  // Caller must either own the wallet or be the target user (leave)
  const walletCheck = await query<{ user_id: string }>(
    "select user_id from wallets where id = $1 and archived_at is null",
    [walletId]
  );
  const wallet = walletCheck.rows[0];
  if (!wallet) {
    return NextResponse.json({ error: "Dompet tidak ditemukan." }, { status: 404 });
  }

  const isOwner = wallet.user_id === auth.user.id;
  const isSelf = targetUserId === auth.user.id;

  if (!isOwner && !isSelf) {
    return NextResponse.json({ error: "Tidak memiliki izin." }, { status: 403 });
  }

  // Owner cannot remove themselves via this endpoint (they own the wallet)
  if (isOwner && targetUserId === wallet.user_id) {
    return NextResponse.json({ error: "Pemilik tidak bisa keluar dari dompet sendiri." }, { status: 400 });
  }

  const result = await query(
    "delete from wallet_members where wallet_id = $1 and user_id = $2",
    [walletId, targetUserId]
  );

  if ((result.rowCount ?? 0) === 0) {
    return NextResponse.json({ error: "Anggota tidak ditemukan." }, { status: 404 });
  }

  // If no members remain, flip is_shared back to false
  const remaining = await query(
    "select count(*)::int as cnt from wallet_members where wallet_id = $1",
    [walletId]
  );
  if ((remaining.rows[0]?.cnt ?? 0) === 0) {
    await query("update wallets set is_shared = false where id = $1", [walletId]);
  }

  return NextResponse.json({ ok: true });
}
