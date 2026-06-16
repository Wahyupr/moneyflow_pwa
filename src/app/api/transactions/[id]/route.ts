import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";

export const runtime = "nodejs";

/**
 * GET /api/transactions/[id]
 *
 * Returns a single transaction including the stored receipt image data URL,
 * scoped to the requesting user via RLS.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await params;
  const { data, error } = await auth.db
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });
  }

  // pg returns timestamptz as Date and bigint as string — normalize for the client.
  const tx = data as Record<string, unknown>;
  return NextResponse.json({
    transaction: {
      ...tx,
      amount_minor: Number(tx.amount_minor),
      occurred_at:
        tx.occurred_at instanceof Date ? tx.occurred_at.toISOString() : String(tx.occurred_at)
    }
  });
}
