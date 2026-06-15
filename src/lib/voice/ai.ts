/**
 * AI fallback for parsing ambiguous/long Indonesian voice transcripts.
 *
 * Uses an OpenAI-compatible chat-completions gateway (same as the receipt OCR
 * path). Only called when the rule parser is not confident, so most short
 * inputs ("kopi 25rb gopay") still parse offline.
 */

import type { ParsedVoiceTransaction } from "@/lib/voice/parse";

// Voice prompts are short — sonnet is plenty (and cheaper than opus). Override
// per-feature with AI_VOICE_MODEL; the receipt path uses AI_MODEL separately.
const DEFAULT_MODEL = "kr/claude-sonnet-4.6";

function getConfig() {
  const apiKey = process.env.GATEWAY_API_KEY ?? process.env.AI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const baseUrl = (process.env.GATEWAY_BASE_URL ?? process.env.AI_BASE_URL ?? "").replace(/\/+$/, "");
  const model = process.env.GATEWAY_MODEL_VOICE ?? DEFAULT_MODEL;
  return { apiKey, baseUrl, model };
}

export function isAiConfigured(): boolean {
  const { apiKey, baseUrl } = getConfig();
  return Boolean(apiKey && baseUrl);
}

const SYSTEM_PROMPT = [
  "You parse Indonesian personal-finance voice notes into a single transaction.",
  "Return JSON only, no markdown, no backticks. Keys: transaction_type ('expense'|'income'), amount_minor (integer rupiah), description (short, no amount/wallet words), wallet_hint (string or null), category_hint (string or null).",
  "If no wallet/payment method is mentioned, set wallet_hint to 'Cash'.",
  "amount_minor is whole rupiah, e.g. '50 ribu' => 50000, '1,5 juta' => 1500000.",
  "category_hint examples: 'Makan & Minum', 'Transportasi', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Gaji'.",
  "If the note clearly describes income (gaji, bonus, terima uang), use 'income'; otherwise 'expense'."
].join(" ");

/**
 * Parses a transcript with the AI gateway. Throws on network/parse errors so
 * the caller can fall back to the rule-based result.
 */
export async function parseVoiceWithAi(transcript: string): Promise<ParsedVoiceTransaction> {
  const { apiKey, baseUrl, model } = getConfig();
  if (!apiKey || !baseUrl) {
    throw new Error("AI gateway not configured.");
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Transcript: ${transcript}` }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const json = JSON.parse(cleaned);

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
