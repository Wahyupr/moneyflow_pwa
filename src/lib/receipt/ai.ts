/**
 * AI receipt/QRIS/transfer-proof parser using the Anthropic-compatible vision
 * endpoint (z.ai). Extracts a single transaction from an image.
 */

export type ParsedReceipt = {
  transaction_type: "expense" | "income";
  amount_minor: number;
  merchant_name: string | null;
  occurred_at: string | null;
  payment_method: string | null;
  category_hint: string | null;
};

const DEFAULT_BASE_URL = "https://api.z.ai/api/anthropic";
const DEFAULT_MODEL = "claude-3-5-sonnet-20241022";

function getConfig() {
  const apiKey = process.env.AI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const baseUrl = (process.env.AI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env.AI_MODEL ?? DEFAULT_MODEL;
  return { apiKey, baseUrl, model };
}

export function isReceiptAiConfigured(): boolean {
  return Boolean(getConfig().apiKey);
}

const SYSTEM_PROMPT = [
  "You read Indonesian receipts, QRIS screenshots, and bank/e-wallet transfer proofs.",
  "Return JSON only, no markdown. Keys: transaction_type ('expense'|'income'), amount_minor (integer rupiah of the TOTAL paid), merchant_name (string or null), occurred_at (ISO 8601 or null), payment_method (string or null), category_hint (string or null).",
  "amount_minor is whole rupiah (e.g. Rp50.000 => 50000). Use the grand total, not subtotals.",
  "category_hint examples: 'Makan & Minum', 'Transportasi', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan'.",
  "Most receipts are expenses. Use 'income' only for clearly incoming money."
].join(" ");

/**
 * Parses a base64 image (no data URL prefix) with the AI vision model. Throws
 * on network/parse errors so the caller can surface a friendly message.
 */
export async function parseReceiptWithAi(base64Image: string, mediaType: string): Promise<ParsedReceipt> {
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
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64Image } },
            { type: "text", text: "Extract the transaction from this image." }
          ]
        }
      ]
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
    merchant_name: typeof json.merchant_name === "string" ? json.merchant_name : null,
    occurred_at: typeof json.occurred_at === "string" ? json.occurred_at : null,
    payment_method: typeof json.payment_method === "string" ? json.payment_method : null,
    category_hint: typeof json.category_hint === "string" ? json.category_hint : null
  };
}
