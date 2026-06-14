import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { parseVoiceTransaction, type ParsedVoiceTransaction } from "@/lib/voice/parse";
import { isAiConfigured, parseVoiceWithAi } from "@/lib/voice/ai";

export const runtime = "nodejs";

const VoiceSchema = z.object({
  transcript: z.string().min(1).max(500),
  occurred_at: z.string().datetime().optional(),
  /** When false, only return the parsed preview without saving. */
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
    wallets.find((wallet) => wallet.type === "cash") ??
    wallets.find((wallet) => norm(wallet.name).includes("cash") || norm(wallet.name).includes("tunai")) ??
    null
  );
}

/**
 * Picks the best wallet for the parsed hint. Returns null for a Cash hint with
 * no cash wallet, so the caller can auto-create one (never silently use GoPay).
 */
function matchWallet(parsed: ParsedVoiceTransaction, wallets: WalletRow[]): WalletRow | null {
  if (wallets.length === 0) {
    return null;
  }

  const hint = parsed.wallet_hint ? norm(parsed.wallet_hint) : null;

  // "Cash" hint (or no wallet mentioned) => only a real cash wallet, else null.
  if (isCashHint(parsed)) {
    return findCashWallet(wallets);
  }

  const byInstitution = wallets.find((wallet) => wallet.institution_name && norm(wallet.institution_name) === hint);
  if (byInstitution) {
    return byInstitution;
  }
  const byName = wallets.find((wallet) => norm(wallet.name).includes(hint!) || hint!.includes(norm(wallet.name)));
  if (byName) {
    return byName;
  }

  // Provider mentioned but no matching wallet => fall back to cash if available.
  return findCashWallet(wallets) ?? wallets[0];
}



function matchCategory(parsed: ParsedVoiceTransaction, categories: CategoryRow[]): CategoryRow | null {
  const ofType = categories.filter((category) => category.type === parsed.transaction_type);

  if (parsed.category_hint) {
    const hint = norm(parsed.category_hint);
    const exact = ofType.find((category) => norm(category.name) === hint);
    if (exact) {
      return exact;
    }
    const partial = ofType.find((category) => norm(category.name).includes(hint) || hint.includes(norm(category.name)));
    if (partial) {
      return partial;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const parsedBody = VoiceSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Transcript is required." }, { status: 400 });
  }

  const { transcript, occurred_at, commit } = parsedBody.data;

  // 1) Try the rule-based parser. 2) Fall back to AI only when not confident
  // and AI is configured. AI errors degrade gracefully to the rule result.
  let parsed = parseVoiceTransaction(transcript);
  let usedAi = false;
  if (!parsed.confident && isAiConfigured()) {
    try {
      parsed = await parseVoiceWithAi(transcript);
      usedAi = true;
    } catch {
      // keep rule-based result
    }
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

  // If the transcript mentions a known merchant (e.g. "Netflix"), use the
  // merchant's name as the description and its DB-assigned category.
  const transcriptNorm = norm(transcript);
  const knownMerchant = ((merchants ?? []) as MerchantRow[]).find(
    (merchant) => merchant.name && transcriptNorm.includes(norm(merchant.name))
  );
  if (knownMerchant) {
    parsed = { ...parsed, description: knownMerchant.name };
  }

  const walletList = (wallets ?? []) as WalletRow[];
  let wallet = matchWallet(parsed, walletList);
  // Prefer the merchant's category from the directory; else keyword match.
  const merchantCategory = knownMerchant?.category_id
    ? categoryRows.find((category) => category.id === knownMerchant.category_id) ?? null
    : null;
  const category = merchantCategory ?? matchCategory(parsed, categoryRows);

  // A Cash transaction with no cash wallet yet => we'll auto-create one on save.
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

  // Preview-only mode: return what we parsed without saving.
  if (commit === false) {
    return NextResponse.json({ preview });
  }

  if (parsed.amount_minor <= 0) {
    return NextResponse.json({ error: "Nominal tidak terdeteksi dari suara.", preview }, { status: 422 });
  }

  // Auto-provision a default Cash wallet so "tanpa sebut dompet = cash" always
  // lands on a real cash wallet instead of an unrelated e-wallet.
  if (!wallet && isCashHint(parsed)) {
    const { data: createdCash, error: cashError } = await auth.supabase
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
    return NextResponse.json({ error: "Belum ada dompet. Tambahkan dompet dulu.", preview }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("transactions")
    .insert({
      user_id: auth.user.id,
      wallet_id: wallet.id,

      category_id: category?.id ?? null,
      transaction_type: parsed.transaction_type,
      amount_minor: parsed.amount_minor,
      currency: "IDR",
      occurred_at: occurred_at ?? new Date().toISOString(),
      merchant_name: parsed.description || null,
      note: transcript,
      input_method: "voice"
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message, preview }, { status: 500 });
  }

  return NextResponse.json({ transaction: data, preview }, { status: 201 });
}
