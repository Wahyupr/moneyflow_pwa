/**
 * AI financial advisor for Pro users.
 * Answers financial questions using the user's actual data as context.
 */

// Reuse the same gateway config as voice AI
const DEFAULT_MODEL = "kr/claude-sonnet-4.6";

function getConfig() {
  const apiKey = process.env.GATEWAY_API_KEY ?? process.env.AI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const baseUrl = (process.env.GATEWAY_BASE_URL ?? process.env.AI_BASE_URL ?? "").replace(/\/+$/, "");
  const model = process.env.GATEWAY_MODEL_CHAT ?? process.env.GATEWAY_MODEL_VOICE ?? DEFAULT_MODEL;
  return { apiKey, baseUrl, model };
}

export function isFinancialAiConfigured(): boolean {
  const { apiKey, baseUrl } = getConfig();
  return Boolean(apiKey && baseUrl);
}

// Keyword patterns that identify financial questions vs. transaction inputs
const QUESTION_PATTERNS = [
  /\b(berapa|bagaimana|apa|kenapa|mengapa|kapan|siapa|bisakah|bisa|tolong|saran|bantu|analisis|analisa|review|ceritakan|jelaskan|rekomendasikan|rekomen)\b/i,
  /\b(pengeluaran|pemasukan|saldo|budget|tabungan|hutang|piutang|cicilan|hemat|boros|keuangan|finansial|investasi|nabung)\b.*\?/i,
  /\?([ \t]*$)/m,
  /\b(terbesar|terkecil|paling|rata-rata|total|trend|grafik|laporan|bulan ini|minggu ini|tahun ini|kemarin|lalu|terakhir)\b/i,
];

const NON_QUESTION_PATTERNS = [
  // Looks like a transaction: contains amount keywords
  /\b\d+\s*(rb|ribu|k|jt|juta|m|ratus|rbu)\b/i,
  /\brp\.?\s*\d/i,
];

export function isFinancialQuestion(message: string): boolean {
  // If it clearly has an amount, treat as transaction
  if (NON_QUESTION_PATTERNS.some((p) => p.test(message))) return false;
  // If it matches question patterns, treat as question
  return QUESTION_PATTERNS.some((p) => p.test(message));
}

export type FinancialContext = {
  wallets: { name: string; balance_minor: number; currency: string }[];
  thisMonthExpense: number;
  thisMonthIncome: number;
  topCategories: { name: string; total_minor: number }[];
  budgets: { name: string; allocated_minor: number; spent_minor: number }[];
};

function formatRupiah(minor: number): string {
  const major = minor / 100;
  if (major >= 1_000_000) return `Rp ${(major / 1_000_000).toFixed(1)} juta`;
  if (major >= 1_000) return `Rp ${(major / 1_000).toFixed(0)} ribu`;
  return `Rp ${major.toFixed(0)}`;
}

function buildSystemPrompt(ctx: FinancialContext): string {
  const walletSummary = ctx.wallets
    .map((w) => `  - ${w.name}: ${formatRupiah(w.balance_minor)}`)
    .join("\n");

  const categorySummary = ctx.topCategories
    .slice(0, 5)
    .map((c) => `  - ${c.name}: ${formatRupiah(c.total_minor)}`)
    .join("\n");

  const budgetSummary = ctx.budgets.length
    ? ctx.budgets
        .map((b) => {
          const pct = b.allocated_minor > 0
            ? Math.round((b.spent_minor / b.allocated_minor) * 100)
            : 0;
          return `  - ${b.name}: dipakai ${formatRupiah(b.spent_minor)} dari ${formatRupiah(b.allocated_minor)} (${pct}%)`;
        })
        .join("\n")
    : "  (tidak ada budget aktif)";

  return [
    "Kamu adalah asisten keuangan personal yang cerdas dan ramah untuk aplikasi MoneyFlow.",
    "Kamu memiliki akses ke data keuangan nyata user dan harus menjawab berdasarkan data tersebut.",
    "Jawab dalam Bahasa Indonesia, singkat dan actionable. Gunakan angka nyata dari data.",
    "JANGAN keluar dari konteks keuangan personal. Tolak pertanyaan di luar topik keuangan dengan sopan.",
    "",
    "=== DATA KEUANGAN USER SAAT INI ===",
    "",
    "Saldo Dompet:",
    walletSummary || "  (tidak ada dompet)",
    "",
    `Bulan Ini:`,
    `  - Total pengeluaran: ${formatRupiah(ctx.thisMonthExpense)}`,
    `  - Total pemasukan: ${formatRupiah(ctx.thisMonthIncome)}`,
    `  - Selisih: ${formatRupiah(ctx.thisMonthIncome - ctx.thisMonthExpense)}`,
    "",
    "Top Kategori Pengeluaran Bulan Ini:",
    categorySummary || "  (belum ada transaksi)",
    "",
    "Status Budget:",
    budgetSummary,
    "",
    "=== AKHIR DATA ===",
    "",
    "Berikan saran yang konkret, personal, dan berdasarkan data di atas.",
  ].join("\n");
}

export async function answerFinancialQuestion(
  message: string,
  ctx: FinancialContext
): Promise<string> {
  const { apiKey, baseUrl, model } = getConfig();
  if (!apiKey || !baseUrl) {
    return buildOfflineAnswer(message, ctx);
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: false,
      max_tokens: 600,
      messages: [
        { role: "system", content: buildSystemPrompt(ctx) },
        { role: "user", content: message },
      ],
    }),
  });

  if (!response.ok) throw new Error(`AI gateway error: ${response.status}`);

  const data = await response.json() as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from AI");
  return text;
}

// Offline fallback when AI gateway not configured
function buildOfflineAnswer(message: string, ctx: FinancialContext): string {
  const msg = message.toLowerCase();

  if (/saldo|dompet/.test(msg)) {
    if (!ctx.wallets.length) return "Kamu belum punya dompet. Yuk tambahkan dompet pertama kamu!";
    const lines = ctx.wallets.map((w) => `• ${w.name}: ${formatRupiah(w.balance_minor)}`);
    return `Saldo dompet kamu:\n${lines.join("\n")}`;
  }

  if (/pengeluaran|keluar/.test(msg)) {
    return `Pengeluaran bulan ini: ${formatRupiah(ctx.thisMonthExpense)}`;
  }

  if (/pemasukan|masuk|gaji/.test(msg)) {
    return `Pemasukan bulan ini: ${formatRupiah(ctx.thisMonthIncome)}`;
  }

  if (/budget/.test(msg)) {
    if (!ctx.budgets.length) return "Belum ada budget aktif. Buat budget di menu Budget!";
    const lines = ctx.budgets.map((b) => {
      const pct = b.allocated_minor > 0 ? Math.round((b.spent_minor / b.allocated_minor) * 100) : 0;
      return `• ${b.name}: ${pct}% terpakai`;
    });
    return `Status budget:\n${lines.join("\n")}`;
  }

  return `Pengeluaran bulan ini ${formatRupiah(ctx.thisMonthExpense)}, pemasukan ${formatRupiah(ctx.thisMonthIncome)}.`;
}
