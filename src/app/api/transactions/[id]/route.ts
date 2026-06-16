import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";

export const runtime = "nodejs";

/**
 * GET /api/transactions/[id]
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const { data, error } = await auth.db
    .from("transactions")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Transaksi tidak ditemukan." }, { status: 404 });

  const tx = data as Record<string, unknown>;
  return NextResponse.json({
    transaction: {
      ...tx,
      amount_minor: Number(tx.amount_minor),
      occurred_at: tx.occurred_at instanceof Date ? tx.occurred_at.toISOString() : String(tx.occurred_at)
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
 * PATCH /api/transactions/[id] — partial edit, scoped to the requesting user.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
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
    .eq("user_id", auth.user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transaction: data });
}

/**
 * DELETE /api/transactions/[id] — scoped to the requesting user.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const { error } = await auth.db
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
