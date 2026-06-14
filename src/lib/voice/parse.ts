/**
 * Rule-based parser for Indonesian voice transaction input.
 *
 * Extracts amount, transaction type, wallet/provider, and description without
 * any AI. Returns a confidence flag so callers can decide whether to fall back
 * to an AI parser for long/ambiguous utterances.
 */

export type ParsedVoiceTransaction = {
  transaction_type: "expense" | "income";
  amount_minor: number;
  description: string;
  wallet_hint: string | null;
  category_hint: string | null;
  /** True when the rule parser is confident; false suggests AI fallback. */
  confident: boolean;
};

const INCOME_KEYWORDS = ["gaji", "terima", "diterima", "pemasukan", "masuk", "bonus", "untung", "pendapatan", "dapat", "thr", "transferan"];

const WALLET_KEYWORDS: { hint: string; patterns: string[] }[] = [
  { hint: "GoPay", patterns: ["gopay", "go pay", "go-pay"] },
  { hint: "OVO", patterns: ["ovo"] },
  { hint: "DANA", patterns: ["dana"] },
  { hint: "ShopeePay", patterns: ["shopeepay", "shopee pay", "spay"] },
  { hint: "LinkAja", patterns: ["linkaja", "link aja"] },
  { hint: "BCA", patterns: ["bca"] },
  { hint: "Bank Mandiri", patterns: ["mandiri"] },
  { hint: "BRI", patterns: ["bri"] },
  { hint: "BNI", patterns: ["bni"] },
  { hint: "Cash", patterns: ["cash", "tunai", "uang tunai", "kontan"] }
];

const CATEGORY_KEYWORDS: { hint: string; patterns: string[] }[] = [
  { hint: "Makan & Minum", patterns: ["makan", "minum", "kopi", "ngopi", "sarapan", "makan siang", "makan malam", "jajan", "snack", "gofood", "grabfood"] },
  { hint: "Transportasi", patterns: ["bensin", "transport", "ojek", "gojek", "grab", "parkir", "tol", "kereta", "busway", "taksi", "bbm"] },
  { hint: "Belanja", patterns: ["belanja", "beli", "shopee", "tokopedia", "supermarket", "indomaret", "alfamart", "baju"] },
  { hint: "Tagihan", patterns: ["tagihan", "listrik", "pln", "pulsa", "internet", "wifi", "air", "pdam", "bpjs"] },
  { hint: "Hiburan", patterns: ["nonton", "bioskop", "game", "netflix", "spotify", "hiburan", "langganan"] },
  { hint: "Kesehatan", patterns: ["obat", "dokter", "apotek", "rumah sakit", "klinik"] },
  { hint: "Gaji", patterns: ["gaji", "thr", "bonus"] }
];

const NUMBER_WORDS: Record<string, number> = {
  nol: 0,
  satu: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
  sepuluh: 10,
  sebelas: 11,
  seratus: 100,
  seribu: 1000
};

/** Parses an amount from Indonesian text (e.g. "50 ribu", "1,5 juta", "25rb"). */
export function parseAmount(text: string): number | null {
  const lower = text.toLowerCase();

  // Pattern: number + unit (ribu/rb/k/juta/jt/m).
  const unitMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(ribu|rb|rebu|k|juta|jt|m)\b/);
  if (unitMatch) {
    const base = Number(unitMatch[1].replace(",", "."));
    const unit = unitMatch[2];
    const multiplier = unit === "juta" || unit === "jt" || unit === "m" ? 1_000_000 : 1000;
    return Math.round(base * multiplier);
  }

  // Plain digits, optionally with thousand separators (e.g. "50.000", "50000").
  const digitMatch = lower.match(/(\d[\d.,]*)/);
  if (digitMatch) {
    const digitsOnly = digitMatch[1].replace(/[.,]/g, "");
    const value = Number(digitsOnly);
    if (Number.isFinite(value) && value > 0) {
      return Math.round(value);
    }
  }

  // Spelled-out single words like "seribu" / "seratus ribu".
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (lower.includes(`${word} ribu`)) {
      return value * 1000;
    }
  }
  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (lower.includes(word) && value >= 100) {
      return value;
    }
  }

  return null;
}

function detectType(lower: string): "expense" | "income" {
  return INCOME_KEYWORDS.some((keyword) => lower.includes(keyword)) ? "income" : "expense";
}

function detectWallet(lower: string): string | null {
  for (const wallet of WALLET_KEYWORDS) {
    if (wallet.patterns.some((pattern) => lower.includes(pattern))) {
      return wallet.hint;
    }
  }
  return null;
}

function detectCategory(lower: string): string | null {
  for (const category of CATEGORY_KEYWORDS) {
    if (category.patterns.some((pattern) => lower.includes(pattern))) {
      return category.hint;
    }
  }
  return null;
}

function buildDescription(text: string): string {
  // Strip amount and wallet/payment phrases to leave a clean description.
  let cleaned = text
    .replace(/\b(pakai|pake|dengan|via|lewat|dari|menggunakan)\b\s+[a-z0-9 ]*$/i, "")
    .replace(/(\d+(?:[.,]\d+)?)\s*(ribu|rb|rebu|k|juta|jt|m)\b/gi, "")
    .replace(/rp\.?\s*/gi, "")
    .replace(/(\d[\d.,]*)/g, "")
    .replace(/\b(beli|bayar|untuk|buat)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    cleaned = text.trim();
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Parses a transcript with rules only. The result is marked `confident: false`
 * (so callers can use AI) when the text is long, has no detectable amount, or
 * mentions multiple potential amounts/wallets.
 */
export function parseVoiceTransaction(transcript: string): ParsedVoiceTransaction {
  const text = transcript.trim();
  const lower = text.toLowerCase();
  const amount = parseAmount(text);

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const amountMatches = lower.match(/(\d+(?:[.,]\d+)?)\s*(ribu|rb|rebu|k|juta|jt|m)\b|\d[\d.,]*/g) ?? [];

  // Confidence heuristics: short, single-amount sentences parse reliably.
  const confident = amount !== null && wordCount <= 12 && amountMatches.length <= 1;

  return {
    transaction_type: detectType(lower),
    amount_minor: amount ?? 0,
    description: buildDescription(text),
    // No wallet mentioned in the speech => treat it as Cash.
    wallet_hint: detectWallet(lower) ?? "Cash",
    category_hint: detectCategory(lower),
    confident
  };
}
