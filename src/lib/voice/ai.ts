/**
 * AI fallback for parsing ambiguous/long Indonesian voice transcripts.
 *
 * Uses the Anthropic-compatible endpoint configured via env. Only invoked when
 * the rule parser is not confident, so most inputs never hit the network.
 */

import type { ParsedVoiceTransaction } from "@/lib/voice/parse";

const DEFAULT_BASE_URL = "https://api.z.ai/api/anthropic";
const DEFAULT_MODEL = "claude-3-5-sonnet-20241022";

function getConfig() {
  const apiKey = process.env.AI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const baseUrl = (process.env.AI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env.AI_MODEL ?? DEFAULT_MODEL;
  return { apiKey, baseUrl, model };
}

/** Whether an AI key is configured (so callers can skip the network if not). */
export function isAiConfigured(): boolean {
  return Boolean(getConfig().apiKey);
}

const SYSTEM_PROMPT = [
  "You parse Indonesian personal-finance voice notes into a single transaction.",
  "Return JSON only, no markdown. Keys: transaction_type ('expense'|'income'), amount_minor (integer rupiah), description (short, no amount/wallet words), wallet_hint (string or null), category_hint (string or null).",
  "If no wallet/payment method is mentioned, set wallet_hint to 'Cash'.",
  "amount_minor is whole rupiah, e.g. '50 ribu' => 50000, '1,5 juta' => 1500000.",
  "category_hint examples: 'Makan & Minum', 'Transportasi', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Gaji'.",
  "If the note clearly describes income (gaji, bonus, terima uang), use 'income'; otherwise 'expense'."
].join(" ");

/**
 * Parses a transcript with AI. Throws on network/parse errors so the caller can
 * fall back to the rule-based result.
 */
export async function parseVoiceWithAi(transcript: string): Promise<ParsedVoiceTransaction> {
  const { apiKey, baseUrl, model } = getConfig();
  if (!apiKey) {
    throw new Error("AI not configured.");
  }

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Transcript: ${transcript}` }]
    })
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { content?: Array<{ text?: string }> };
  const text = payload.content?.map((part) => part.text ?? "").join("").trim() ?? "";
  const json = JSON.parse(text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, ""));

  const amount = Math.round(Number(json.amount_minor));

  return {
    transaction_type: json.transaction_type === "income" ? "income" : "expense",
    amount_minor: Number.isFinite(amount) && amount > 0 ? amount : 0,
    description: typeof json.description === "string" ? json.description : transcript,
    wallet_hint: typeof json.wallet_hint === "string" ? json.wallet_hint : null,
    category_hint: typeof json.category_hint === "string" ? json.category_hint : null,
    confident: true
  };
}
