import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

/**
 * Check whether the caller has read/write access to a transaction.
 * Access is granted if:
 *   - The caller owns the wallet the transaction belongs to, OR
 *   - The caller is a wallet_member of that wallet.
 *
 * For write operations (PATCH/DELETE), only the original creator (user_id)
 * or the wallet owner may modify the transaction.
 */
async function canReadTransaction(userId: string, transactionId: string) {
  const result = await query<{ id: string; user_id: string; wallet_owner_id: string }>(
    `select t.id, t.user_id, w.user_id as wallet_owner_id
     from transactions t
     join wallets w on w.id = t.wallet_id
     where t.id = $1
       and (
         w.user_id = $2
         or exists (
           select 1 from wallet_members wm where wm.wallet_id = t.wallet_id and wm.user_id = $2
         )
       )`,
    [transactionId, userId]
  );
  return result.rows[0] ?? null;
}

/**
 * GET /api/transactions/[id]
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const access = await canReadTransaction(auth.user.id, id);
  if (!access) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });

  // Fetch the full transaction with creator info
  const result = await query<Record<string, unknown>>(
    `select t.*,
            coalesce(u.display_name, u.email) as created_by_name,
            w.name as wallet_name
     from transactions t
     join users u on u.id = t.user_id
     join wallets w on w.id = t.wallet_id
     where t.id = $1`,
    [id]
  );

  const tx = result.rows[0];
  if (!tx) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });

  return NextResponse.json({
    transaction: {
      ...tx,
      amount_minor: Number(tx.amount_minor),
      occurred_at: tx.occurred_at instanceof Date ? (tx.occurred_at as Date).toISOString() : String(tx.occurred_at)
    }
  });
}

const PatchSchema = z.object({
  transaction_type: z.enum(["expense", "income", "transfer"]).optional(),
  amount_minor: z.number().int().positive().optional(),
  merchant_name: z.string().max(120).nullable().optional(),
  payment_method: z.string().max(80).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  wallet_id: z.string().uuid().optional(),
  occurred_at: z.string().optional()
});

/**
 * PATCH /api/transactions/[id]
 * Only the original creator or the wallet owner may edit.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const access = await canReadTransaction(auth.user.id, id);
  if (!access) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });

  // Only creator or wallet owner may edit
  if (access.user_id !== auth.user.id && access.wallet_owner_id !== auth.user.id) {
    return NextResponse.json({ error: "Hanya pembuat atau pemilik dompet yang bisa mengedit transaksi." }, { status: 403 });
  }

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid." }, { status: 400 });
  }

  // Coerce occurred_at to full ISO datetime if only date was provided.
  const patch = { ...parsed.data } as Record<string, unknown>;
  if (typeof patch.occurred_at === "string") {
    const raw = patch.occurred_at as string;
    if (!raw.includes("T")) {
      const d = new Date(`${raw}T00:00:00.000Z`);
      patch.occurred_at = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    } else {
      const d = new Date(raw);
      patch.occurred_at = Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    }
  }

  const { data, error } = await auth.db
    .from("transactions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transaction: data });
}

/**
 * DELETE /api/transactions/[id]
 * Only the original creator or the wallet owner may delete.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const access = await canReadTransaction(auth.user.id, id);
  if (!access) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });

  if (access.user_id !== auth.user.id && access.wallet_owner_id !== auth.user.id) {
    return NextResponse.json({ error: "Hanya pembuat atau pemilik dompet yang bisa menghapus transaksi." }, { status: 403 });
  }

  const { error } = await auth.db
    .from("transactions")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
