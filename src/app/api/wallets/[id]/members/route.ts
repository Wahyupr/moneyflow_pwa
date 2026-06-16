import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/wallets/[id]/members
 * Returns the list of members for a wallet the caller owns.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id: walletId } = await context.params;

  // Only the owner can view the member list
  const ownerCheck = await query(
    "select id from wallets where id = $1 and user_id = $2 and archived_at is null",
    [walletId, auth.user.id]
  );
  if (ownerCheck.rows.length === 0) {
    return NextResponse.json({ error: "Dompet tidak ditemukan." }, { status: 404 });
  }

  const result = await query<{
    user_id: string;
    display_name: string | null;
    email: string;
    role: string;
    joined_at: string;
  }>(
    `select wm.user_id, u.display_name, u.email, wm.role, wm.joined_at
     from wallet_members wm
     join users u on u.id = wm.user_id
     where wm.wallet_id = $1
     order by wm.joined_at asc`,
    [walletId]
  );

  // Also include pending (unaccepted) invites
  const invites = await query<{
    id: string;
    invitee_email: string;
    role: string;
    expires_at: string;
    created_at: string;
  }>(
    `select id, invitee_email, role, expires_at, created_at
     from wallet_invites
     where wallet_id = $1 and accepted_at is null and expires_at > now()
     order by created_at desc`,
    [walletId]
  );

  return NextResponse.json({
    members: result.rows,
    pending_invites: invites.rows
  });
}
