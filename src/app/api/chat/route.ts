import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { parseVoiceTransaction, type ParsedVoiceTransaction } from "@/lib/voice/parse";
import { isAiConfigured, parseVoiceWithAi } from "@/lib/voice/ai";
import { consumeAiCredits } from "@/lib/ai-credits";

import { query } from "@/lib/db/pool";

import {
  isFinancialQuestion,
  answerFinancialQuestion,
  type FinancialContext,
} from "@/lib/voice/financial-ai";


export const runtime = "nodejs";

// Keywords that suggest the message is a transaction but is missing an amount
const TRANSACTION_KEYWORDS: string[] = [
  "beli", "bayar", "makan", "minum", "beli", "jajan", "nonton", "isi",
  "transfer", "kirim", "tarik", "setor", "belanja", "beli", "ngopi", "kopi",
  "bensin", "parkir", "ojek", "grab", "gojek", "tagihan", "bayar", "beli",
  "nasi", "ayam", "soto", "bakso", "sate", "mie", "pizza", "burger"
];

const ChatSchema = z.object({
  message: z.string().min(1).max(500),
  /** When false, only parse and preview — do not save to DB. */
  commit: z.boolean().optional(),
  /** Optional chat session to persist the financial Q&A conversation into. */
  session_id: z.string().uuid().optional()
});

/**
 * Persists a user question + assistant answer into a chat session (owned by
 * the user). Also bumps the session's updated_at and derives a title from the
 * first question. Best-effort: failures are logged but never block the reply.
 */
async function persistChatTurn(input: {
  userId: string;
  sessionId: string;
  question: string;
  answer: string;
}): Promise<void> {
  try {
    const owns = await query<{ id: string; title: string }>(
      `select id, title from chat_sessions where id = $1 and user_id = $2`,
      [input.sessionId, input.userId]
    );
    if (owns.rows.length === 0) return;

    await query(
      `insert into chat_messages (session_id, user_id, role, content)
       values ($1, $2, 'user', $3), ($1, $2, 'assistant', $4)`,
      [input.sessionId, input.userId, input.question, input.answer]
    );

    // Name the session after the first question (trimmed) if still default.
    const title = owns.rows[0].title;
    if (title === "Percakapan baru") {
      const derived = input.question.slice(0, 60);
      await query(`update chat_sessions set title = $2, updated_at = now() where id = $1`, [
        input.sessionId,
        derived
      ]);
    } else {
      await query(`update chat_sessions set updated_at = now() where id = $1`, [input.sessionId]);
    }
  } catch (err) {
    console.error("[chat persist]", err);
  }
}


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

  const { message, commit, session_id } = parsedBody.data;

  // Financial assistant is available to ALL plans now (free, premium, pro).

  // Each answered question consumes AI chat credits, and the conversation is
  // persisted into the given chat session.
  if (commit !== true && isFinancialQuestion(message)) {
    // Financial Q&A consumes AI chat credits.
    const credit = await consumeAiCredits({ userId: auth.user.id, action: "chat" });
    if (!credit.ok) {
      return NextResponse.json({ reply: credit.reason });
    }
    try {


      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [
        { data: walletRows },
        { data: expenseRows },
        { data: incomeRows },
        { data: budgetRows },
        { data: categoryRows },
        { data: debtRows },
        { data: debtPaymentRows },
        { data: receivableRows },
        { data: receivablePaymentRows },
      ] = await Promise.all([
        auth.db
          .from("wallets")
          .select("name,balance_minor,currency")
          .eq("user_id", auth.user.id)
          .is("archived_at", null),
        auth.db
          .from("transactions")
          .select("amount_minor,category_id")
          .eq("user_id", auth.user.id)
          .eq("transaction_type", "expense")
          .gte("occurred_at", startOfMonth),
        auth.db
          .from("transactions")
          .select("amount_minor")
          .eq("user_id", auth.user.id)
          .eq("transaction_type", "income")
          .gte("occurred_at", startOfMonth),
        auth.db
          .from("budgets")
          .select("name,allocated_minor,spent_minor")
          .eq("user_id", auth.user.id),
        auth.db.from("categories").select("id,name"),
        auth.db
          .from("debts")
          .select("id,name,creditor_name,total_amount_minor")
          .eq("user_id", auth.user.id)
          .eq("status", "active")
          .limit(200),
        auth.db
          .from("debt_payments")
          .select("debt_id,amount_minor")
          .eq("user_id", auth.user.id),
        auth.db
          .from("receivables")
          .select("id,name,borrower_name,total_amount_minor")
          .eq("user_id", auth.user.id)
          .eq("status", "active")
          .limit(200),
        auth.db
          .from("receivable_payments")
          .select("receivable_id,amount_minor")
          .eq("user_id", auth.user.id),
      ]);

      // Aggregate expenses by category
      const catMap = Object.fromEntries(
        ((categoryRows ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])
      );
      const catTotals: Record<string, number> = {};
      for (const row of (expenseRows ?? []) as { amount_minor: number; category_id: string | null }[]) {
        const name = row.category_id ? (catMap[row.category_id] ?? "Lainnya") : "Lainnya";
        catTotals[name] = (catTotals[name] ?? 0) + row.amount_minor;
      }
      const topCategories = Object.entries(catTotals)
        .map(([name, total_minor]) => ({ name, total_minor }))
        .sort((a, b) => b.total_minor - a.total_minor);

      // Compute remaining balance for debts (total - sum of payments)
      type DebtRow = { id: string; name: string; creditor_name: string; total_amount_minor: number };
      type DebtPaymentRow = { debt_id: string; amount_minor: number };
      const debtPaymentMap: Record<string, number> = {};
      for (const p of (debtPaymentRows ?? []) as DebtPaymentRow[]) {
        debtPaymentMap[p.debt_id] = (debtPaymentMap[p.debt_id] ?? 0) + p.amount_minor;
      }
      const debts = ((debtRows ?? []) as DebtRow[]).map((d) => ({
        name: d.name,
        creditor_name: d.creditor_name,
        total_amount_minor: d.total_amount_minor,
        remaining_minor: Math.max(0, d.total_amount_minor - (debtPaymentMap[d.id] ?? 0)),
      }));

      // Compute remaining balance for receivables
      type ReceivableRow = { id: string; name: string; borrower_name: string; total_amount_minor: number };
      type ReceivablePaymentRow = { receivable_id: string; amount_minor: number };
      const receivablePaymentMap: Record<string, number> = {};
      for (const p of (receivablePaymentRows ?? []) as ReceivablePaymentRow[]) {
        receivablePaymentMap[p.receivable_id] = (receivablePaymentMap[p.receivable_id] ?? 0) + p.amount_minor;
      }
      const receivables = ((receivableRows ?? []) as ReceivableRow[]).map((r) => ({
        name: r.name,
        borrower_name: r.borrower_name,
        total_amount_minor: r.total_amount_minor,
        remaining_minor: Math.max(0, r.total_amount_minor - (receivablePaymentMap[r.id] ?? 0)),
      }));

      const ctx: FinancialContext = {
        wallets: (walletRows ?? []) as FinancialContext["wallets"],
        thisMonthExpense: ((expenseRows ?? []) as { amount_minor: number }[])
          .reduce((s, r) => s + r.amount_minor, 0),
        thisMonthIncome: ((incomeRows ?? []) as { amount_minor: number }[])
          .reduce((s, r) => s + r.amount_minor, 0),
        topCategories,
        budgets: (budgetRows ?? []) as FinancialContext["budgets"],
        debts,
        receivables,
      };

      const reply = await answerFinancialQuestion(message, ctx);
      if (session_id) {
        await persistChatTurn({ userId: auth.user.id, sessionId: session_id, question: message, answer: reply });
      }
      return NextResponse.json({ reply });
    } catch {
      // Fall through to transaction parsing on error
    }
  }


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

  // Preview only — but only if we actually detected a valid transaction
  if (commit === false) {
    if (parsed.amount_minor <= 0) {
      // Decide if the message looks like a transaction missing an amount,
      // or if it's completely off-topic.
      const looksLikeTransaction =
        parsed.category_hint !== null ||
        parsed.wallet_hint !== null ||
        TRANSACTION_KEYWORDS.some((kw) => message.toLowerCase().includes(kw));

      if (looksLikeTransaction) {
        return NextResponse.json({
          reply: `Berapa nominalnya? Contoh: "${message} 25rb"`
        });
      }

      return NextResponse.json({
        reply: "Hei! Aku fokus membantu pencatatan keuangan kamu ya 💰\n\nCoba ketik transaksi seperti:\n• \"Kopi 25rb gopay\"\n• \"Makan siang 45rb\"\n• \"Gaji 5 juta\"\n• \"Bensin 50rb cash\""
      });
    }
    return NextResponse.json({ preview });
  }

  if (parsed.amount_minor <= 0) {
    return NextResponse.json(
      { error: "Nominal tidak terdeteksi. Coba tulis ulang, contoh: 'kopi 25rb gopay'.", preview },
      { status: 422 }
    );
  }

  // Charge AI credits only when the AI parser actually interpreted the message.
  if (usedAi) {
    const credit = await consumeAiCredits({ userId: auth.user.id, action: "voice" });
    if (!credit.ok) {
      return NextResponse.json({ error: credit.reason, preview }, { status: 402 });
    }
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
