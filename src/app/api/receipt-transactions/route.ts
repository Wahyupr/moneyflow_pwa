import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { isReceiptAiConfigured, parseReceiptWithAi, type ParsedReceipt } from "@/lib/receipt/ai";

export const runtime = "nodejs";

const ReceiptSchema = z.object({
  // base64 image WITHOUT the data URL prefix.
  image_base64: z.string().min(16),
  media_type: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
  occurred_at: z.string().datetime().optional(),
  /** When false, only return the parsed preview without saving. */
  commit: z.boolean().optional(),
  /** Optional explicit wallet chosen by the user in the review screen. */
  wallet_id: z.string().uuid().optional()
});

type WalletRow = { id: string; name: string; type: string; institution_name: string | null };
type CategoryRow = { id: string; name: string; type: string };
type MerchantRow = { name: string; category_id: string | null };

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findCashWallet(wallets: WalletRow[]): WalletRow | null {
  return (
    wallets.find((wallet) => wallet.type === "cash") ??
    wallets.find((wallet) => norm(wallet.name).includes("cash") || norm(wallet.name).includes("tunai")) ??
    null
  );
}

/** Matches the receipt's payment method against the user's wallets. */
function matchWallet(parsed: ParsedReceipt, wallets: WalletRow[]): WalletRow | null {
  if (wallets.length === 0) {
    return null;
  }
  if (parsed.payment_method) {
    const hint = norm(parsed.payment_method);
    const byInstitution = wallets.find((wallet) => wallet.institution_name && norm(wallet.institution_name) === hint);
    if (byInstitution) {
      return byInstitution;
    }
    const byName = wallets.find((wallet) => norm(wallet.name).includes(hint) || hint.includes(norm(wallet.name)));
    if (byName) {
      return byName;
    }
  }
  return findCashWallet(wallets) ?? wallets[0];
}

function matchCategory(parsed: ParsedReceipt, categories: CategoryRow[]): CategoryRow | null {
  const ofType = categories.filter((category) => category.type === parsed.transaction_type);
  if (parsed.category_hint) {
    const hint = norm(parsed.category_hint);
    return (
      ofType.find((category) => norm(category.name) === hint) ??
      ofType.find((category) => norm(category.name).includes(hint) || hint.includes(norm(category.name))) ??
      null
    );
  }
  return null;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  if (!isReceiptAiConfigured()) {
    return NextResponse.json({ error: "Fitur scan struk belum dikonfigurasi (AI key)." }, { status: 503 });
  }

  const parsedBody = ReceiptSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Gambar struk tidak valid." }, { status: 400 });
  }

  const { image_base64, media_type, occurred_at, commit, wallet_id } = parsedBody.data;

  let parsed: ParsedReceipt;
  try {
    parsed = await parseReceiptWithAi(image_base64, media_type);
  } catch {
    return NextResponse.json({ error: "Gagal membaca struk. Coba foto yang lebih jelas." }, { status: 502 });
  }

  const [{ data: wallets }, { data: systemCategories }, { data: merchants }] = await Promise.all([
    auth.supabase
      .from("wallets")
      .select("id,name,type,institution_name")
      .eq("user_id", auth.user.id)
      .is("archived_at", null)
      .order("created_at"),
    auth.supabase.from("categories").select("id,name,type").eq("is_system", true),
    auth.supabase.from("merchants").select("name,category_id").eq("is_system", true)
  ]);

  const categoryRows = (systemCategories ?? []) as CategoryRow[];
  const walletList = (wallets ?? []) as WalletRow[];

  // If the receipt merchant matches the directory, normalize the name and use
  // its DB-assigned category.
  let merchantName = parsed.merchant_name;
  const knownMerchant = merchantName
    ? ((merchants ?? []) as MerchantRow[]).find((merchant) => merchant.name && norm(merchantName!).includes(norm(merchant.name)))
    : undefined;
  if (knownMerchant) {
    merchantName = knownMerchant.name;
  }

  const explicitWallet = wallet_id ? walletList.find((wallet) => wallet.id === wallet_id) ?? null : null;
  const wallet = explicitWallet ?? matchWallet(parsed, walletList);
  const merchantCategory = knownMerchant?.category_id
    ? categoryRows.find((category) => category.id === knownMerchant.category_id) ?? null
    : null;
  const category = merchantCategory ?? matchCategory(parsed, categoryRows);

  const preview = {
    transaction_type: parsed.transaction_type,
    amount_minor: parsed.amount_minor,
    merchant_name: merchantName,
    payment_method: parsed.payment_method,
    occurred_at: parsed.occurred_at,
    wallet_id: wallet?.id ?? null,
    wallet_name: wallet?.name ?? null,
    category_id: category?.id ?? null,
    category_name: category?.name ?? null
  };

  // Preview-only mode: return parsed result without saving.
  if (commit === false) {
    return NextResponse.json({ preview });
  }

  if (parsed.amount_minor <= 0) {
    return NextResponse.json({ error: "Nominal tidak terbaca dari struk.", preview }, { status: 422 });
  }
  if (!wallet) {
    return NextResponse.json({ error: "Belum ada dompet. Tambahkan dompet dulu.", preview }, { status: 400 });
  }

  const occurredAt = occurred_at ?? parsed.occurred_at ?? new Date().toISOString();

  const { data, error } = await auth.supabase
    .from("transactions")
    .insert({
      user_id: auth.user.id,
      wallet_id: wallet.id,
      category_id: category?.id ?? null,
      transaction_type: parsed.transaction_type,
      amount_minor: parsed.amount_minor,
      currency: "IDR",
      occurred_at: new Date(occurredAt).toISOString(),
      merchant_name: merchantName,
      payment_method: parsed.payment_method,
      input_method: "receipt_scan"
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, preview }, { status: 500 });
  }

  return NextResponse.json({ transaction: data, preview }, { status: 201 });
}
