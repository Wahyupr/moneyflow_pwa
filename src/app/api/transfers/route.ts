import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";

export const runtime = "nodejs";

const TransferSchema = z.object({
  from_wallet_id: z.string().uuid(),
  to_wallet_id: z.string().uuid(),
  amount_minor: z.number().int().positive(),
  currency: z.string().length(3).default("IDR"),
  note: z.string().max(500).nullable().optional(),
  occurred_at: z.string().datetime()
});

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const parsed = TransferSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transfer payload." }, { status: 400 });
  }

  const { data, error } = await auth.supabase.rpc("create_internal_transfer", {
    p_user_id: auth.user.id,
    p_from_wallet_id: parsed.data.from_wallet_id,
    p_to_wallet_id: parsed.data.to_wallet_id,
    p_amount_minor: parsed.data.amount_minor,
    p_currency: parsed.data.currency,
    p_note: parsed.data.note ?? null,
    p_occurred_at: parsed.data.occurred_at
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transfer: data }, { status: 201 });
}
