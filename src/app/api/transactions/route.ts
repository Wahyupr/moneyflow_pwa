import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";

export const runtime = "nodejs";

const TransactionSchema = z.object({
  wallet_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  transaction_type: z.enum(["expense", "income", "transfer"]),
  amount_minor: z.number().int().positive(),
  currency: z.string().length(3).default("IDR"),
  occurred_at: z.string().datetime(),
  merchant_name: z.string().max(120).nullable().optional(),
  payment_method: z.string().max(80).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  input_method: z.enum(["manual", "receipt_scan", "evidence_upload", "voice", "auto_recurring"]).default("manual")
});

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { searchParams } = new URL(request.url);
  let query = auth.db.from("transactions").select("*").eq("user_id", auth.user.id).order("occurred_at", { ascending: false });

  if (searchParams.get("wallet")) {
    query = query.eq("wallet_id", searchParams.get("wallet"));
  }

  if (searchParams.get("type")) {
    query = query.eq("transaction_type", searchParams.get("type"));
  }

  const { data, error } = await query.limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Resolve merchant logos by name from the global merchant directory.
  const { data: merchants } = await auth.db.from("merchants").select("name,logo_url").eq("is_system", true);
  const merchantLogoByName = new Map<string, string>();
  for (const merchant of (merchants ?? []) as Array<{ name: string; logo_url: string | null }>) {
    if (merchant.logo_url) {
      merchantLogoByName.set(merchant.name.trim().toLowerCase(), merchant.logo_url);
    }
  }

  const transactions = ((data ?? []) as Array<Record<string, unknown>>).map((transaction) => ({
    ...transaction,
    merchant_logo_url:
      typeof transaction.merchant_name === "string"
        ? merchantLogoByName.get(transaction.merchant_name.trim().toLowerCase()) ?? null
        : null
  }));

  return NextResponse.json({ transactions }, {
    headers: { "Cache-Control": "no-store" }
  });
}


export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const parsed = TransactionSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transaction payload." }, { status: 400 });
  }

  const { data, error } = await auth.db
    .from("transactions")
    .insert({ ...parsed.data, user_id: auth.user.id })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transaction: data }, { status: 201 });
}
