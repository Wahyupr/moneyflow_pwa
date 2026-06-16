import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { isReceiptAiConfigured, parseReceiptWithAi, type ParsedReceipt } from "@/lib/receipt/ai";

export const runtime = "nodejs";

// Scan/preview from an image (no manual fields yet).
const ScanSchema = z.object({
  image_base64: z.string().min(16),
  media_type: z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
  commit: z.literal(false)
});

// Save the (possibly user-edited) transaction. The client sends the final
// values chosen on the review screen, so we never re-run the AI here.
const SaveSchema = z.object({
  commit: z.literal(true),
  transaction_type: z.enum(["expense", "income"]),
  amount_minor: z.number().int().positive(),
  merchant_name: z.string().max(120).nullable().optional(),
  wallet_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  payment_method: z.string().max(80).nullable().optional(),
  // Accept any date/datetime string from the AI (e.g. "2026-06-15" or full ISO).
  occurred_at: z.string().optional(),
  // Compressed receipt photo as a data URL ("data:image/jpeg;base64,...").
  // Stored on the transaction so the user can view the proof later.
  // Accept any reasonable size — oversized images are trimmed server-side.
  receipt_image_data_url: z.string().startsWith("data:").optional()
});

type WalletRow = { id: string; name: string; type: string; institution_name: string | null };
type CategoryRow = { id: string; name: string; type: string };
type MerchantRow = { name: string; category_id: string | null };

/**
 * Coerce any date/datetime string from the AI into a full ISO 8601 datetime.
 * The AI may return "2026-06-15" (date only) or a full ISO string. Postgres
 * timestamptz requires a time component, so we append T00:00:00Z when missing.
 */
function toIsoDatetime(value: string | undefined | null): string {
  if (!value) return new Date().toISOString();
  // Already a full ISO datetime (contains "T")
  if (value.includes("T")) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  // Date-only string like "2026-06-15" — treat as local midnight UTC
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

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

  const body = await request.json().catch(() => null);

  // Route based on commit flag to avoid ambiguous fall-through.
  const isCommit = body !== null && typeof body === "object" && (body as Record<string, unknown>).commit === true;

  // --- SAVE PATH: persist the reviewed/edited transaction. ---
  if (isCommit) {
    const save = SaveSchema.safeParse(body);
    if (!save.success) {
      const msg = save.error.errors.map((e) => e.message).join("; ");
      return NextResponse.json({ error: `Data tidak valid: ${msg}` }, { status: 400 });
    }

    // Trim oversized receipt images to protect DB row size (>1.5 MB → skip).
    const receiptUrl = save.data.receipt_image_data_url;
    const safeReceiptUrl = receiptUrl && receiptUrl.length <= 1_500_000 ? receiptUrl : null;

    const { data, error } = await auth.db
      .from("transactions")
      .insert({
        user_id: auth.user.id,
        wallet_id: save.data.wallet_id,
        category_id: save.data.category_id ?? null,
        transaction_type: save.data.transaction_type,
        amount_minor: save.data.amount_minor,
        currency: "IDR",
        occurred_at: toIsoDatetime(save.data.occurred_at),
        merchant_name: save.data.merchant_name?.trim() ? save.data.merchant_name.trim() : null,
        payment_method: save.data.payment_method ?? null,
        input_method: "receipt_scan",
        receipt_image_data_url: safeReceiptUrl
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ transaction: data }, { status: 201 });
  }

  // --- SCAN PATH: read the image and return an editable preview. ---
  if (!isReceiptAiConfigured()) {
    return NextResponse.json({ error: "Fitur scan struk belum dikonfigurasi (AI key)." }, { status: 503 });
  }

  const scan = ScanSchema.safeParse(body);
  if (!scan.success) {
    return NextResponse.json({ error: "Gambar struk tidak valid." }, { status: 400 });
  }

  let parsed: ParsedReceipt;
  try {
    parsed = await parseReceiptWithAi(scan.data.image_base64, scan.data.media_type);
  } catch {
    return NextResponse.json({ error: "Gagal membaca struk. Coba foto yang lebih jelas." }, { status: 502 });
  }

  const [{ data: wallets }, { data: systemCategories }, { data: merchants }] = await Promise.all([
    auth.db
      .from("wallets")
      .select("id,name,type,institution_name")
      .eq("user_id", auth.user.id)
      .is("archived_at", null)
      .order("created_at"),
    auth.db.from("categories").select("id,name,type").eq("is_system", true),
    // System + user-owned merchants (RLS scopes "own" to the caller).
    auth.db.from("merchants").select("name,category_id")
  ]);

  const categoryRows = (systemCategories ?? []) as CategoryRow[];
  const walletList = (wallets ?? []) as WalletRow[];

  let merchantName = parsed.merchant_name;
  const knownMerchant = merchantName
    ? ((merchants ?? []) as MerchantRow[]).find((merchant) => merchant.name && norm(merchantName!).includes(norm(merchant.name)))
    : undefined;
  if (knownMerchant) {
    merchantName = knownMerchant.name;
  }

  const wallet = matchWallet(parsed, walletList);
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
    category_name: category?.name ?? null,
    // Rich detail (read-only on review screen): item list + breakdown.
    items: parsed.items,
    subtotal: parsed.subtotal,
    tax: parsed.tax,
    discount: parsed.discount,
    service_fee: parsed.service_fee,
    total_amount: parsed.total_amount,
    currency: parsed.currency,
    notes: parsed.notes
  };

  return NextResponse.json({ preview });
}
