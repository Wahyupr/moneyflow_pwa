import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { parseVoiceTransaction, type ParsedVoiceTransaction } from "@/lib/voice/parse";
import { isAiConfigured, parseVoiceWithAi } from "@/lib/voice/ai";

export const runtime = "nodejs";

const ChatSchema = z.object({
  message: z.string().min(1).max(500),
  /** When false, only parse and preview — do not save to DB. */
  commit: z.boolean().optional()
});

type WalletRow = { id: string; name: string; type: string; institution_name: string | null };
type CategoryRow = { id: string; name: string; type: string };
type MerchantRow = { name: string; category_id: string | null };

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isCashHint(parsed: ParsedVoiceTransaction): boolean {
  const hint = parsed.wallet_hint ? norm(parsed.wallet_hint) : null;
  return !hint || hint === norm("Cash") || hint === norm("Tunai");
}

function findCashWallet(wallets: WalletRow[]): WalletRow | null {
  return (
    wallets.find((w) => w.type === "cash") ??
    wallets.find((w) => norm(w.name).includes("cash") || norm(w.name).includes("tunai")) ??
    null
  );
}

function matchWallet(parsed: ParsedVoiceTransaction, wallets: WalletRow[]): WalletRow | null {
  if (wallets.length === 0) return null;
  const hint = parsed.wallet_hint ? norm(parsed.wallet_hint) : null;
  if (isCashHint(parsed)) return findCashWallet(wallets);
  const byInstitution = wallets.find((w) => w.institution_name && norm(w.institution_name) === hint);
  if (byInstitution) return byInstitution;
  const byName = wallets.find((w) => norm(w.name).includes(hint!) || hint!.includes(norm(w.name)));
  if (byName) return byName;
  return findCashWallet(wallets) ?? wallets[0];
}

function matchCategory(parsed: ParsedVoiceTransaction, categories: CategoryRow[]): CategoryRow | null {
  const ofType = categories.filter((c) => c.type === parsed.transaction_type);
  if (parsed.category_hint) {
    const hint = norm(parsed.category_hint);
    const exact = ofType.find((c) => norm(c.name) === hint);
    if (exact) return exact;
    const partial = ofType.find((c) => norm(c.name).includes(hint) || hint.includes(norm(c.name)));
    if (partial) return partial;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const parsedBody = ChatSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Pesan tidak valid." }, { status: 400 });
  }

  const { message, commit } = parsedBody.data;

  // Parse with rule-based first, fallback to AI
  let parsed = parseVoiceTransaction(message);
  let usedAi = false;
  if (!parsed.confident && isAiConfigured()) {
    try {
      parsed = await parseVoiceWithAi(message);
      usedAi = true;
    } catch {
      // keep rule-based result
    }
  }

  const [{ data: wallets }, { data: systemCategories }, { data: merchants }] = await Promise.all([
    auth.db
      .from("wallets")
      .select("id,name,type,institution_name")
      .eq("user_id", auth.user.id)
      .is("archived_at", null)
      .order("created_at"),
    auth.db.from("categories").select("id,name,type").eq("is_system", true),
    auth.db.from("merchants").select("name,category_id").eq("is_system", true)
  ]);

  const categoryRows = (systemCategories ?? []) as CategoryRow[];
  const transcriptNorm = norm(message);
  const knownMerchant = ((merchants ?? []) as MerchantRow[]).find(
    (m) => m.name && transcriptNorm.includes(norm(m.name))
  );
  if (knownMerchant) {
    parsed = { ...parsed, description: knownMerchant.name };
  }

  const walletList = (wallets ?? []) as WalletRow[];
  let wallet = matchWallet(parsed, walletList);
  const merchantCategory = knownMerchant?.category_id
    ? categoryRows.find((c) => c.id === knownMerchant.category_id) ?? null
    : null;
  const category = merchantCategory ?? matchCategory(parsed, categoryRows);
  const willCreateCash = !wallet && isCashHint(parsed);

  const preview = {
    transaction_type: parsed.transaction_type,
    amount_minor: parsed.amount_minor,
    description: parsed.description,
    wallet_id: wallet?.id ?? null,
    wallet_name: wallet?.name ?? (willCreateCash ? "Cash (baru)" : null),
    category_id: category?.id ?? null,
    category_name: category?.name ?? null,
    used_ai: usedAi
  };

  // Preview only
  if (commit === false) {
    return NextResponse.json({ preview });
  }

  if (parsed.amount_minor <= 0) {
    return NextResponse.json(
      { error: "Nominal tidak terdeteksi. Coba tulis ulang, contoh: 'kopi 25rb gopay'.", preview },
      { status: 422 }
    );
  }

  // Auto-create cash wallet if needed
  if (!wallet && isCashHint(parsed)) {
    const { data: createdCash, error: cashError } = await auth.db
      .from("wallets")
      .insert({
        user_id: auth.user.id,
        name: "Cash",
        type: "cash",
        currency: "IDR",
        color: "#2BB673",
        icon: "wallet",
        opening_balance_minor: 0
      })
      .select("id,name,type,institution_name")
      .single();

    if (cashError) {
      return NextResponse.json({ error: cashError.message, preview }, { status: 500 });
    }
    wallet = createdCash as WalletRow;
  }

  if (!wallet) {
    return NextResponse.json(
      { error: "Belum ada dompet. Tambahkan dompet dulu di halaman Dompet.", preview },
      { status: 400 }
    );
  }

  const { data, error } = await auth.db
    .from("transactions")
    .insert({
      user_id: auth.user.id,
      wallet_id: wallet.id,
      category_id: category?.id ?? null,
      transaction_type: parsed.transaction_type,
      amount_minor: parsed.amount_minor,
      currency: "IDR",
      occurred_at: new Date().toISOString(),
      merchant_name: parsed.description || null,
      note: message,
      input_method: "chat"
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, preview }, { status: 500 });
  }

  return NextResponse.json({ transaction: data, preview }, { status: 201 });
}
