/**
 * AI parser for receipts, QRIS screenshots, transfer proofs, and shipping
 * receipts. Uses an OpenAI-compatible chat-completions gateway (per the
 * struk-ocr reference) which gives more accurate, structured output than the
 * previous Anthropic Messages call.
 */

export type ReceiptItem = {
  name: string;
  quantity: string | null;
  unit_price: number | null;
  amount: number | null;
};

export type ParsedReceipt = {
  // Mapped/derived fields used by the rest of the app:
  transaction_type: "expense" | "income";
  amount_minor: number;
  merchant_name: string | null;
  occurred_at: string | null;
  payment_method: string | null;
  category_hint: string | null;

  // Rich detail from the model (read-only in the review screen):
  items: ReceiptItem[];
  subtotal: number | null;
  tax: number | null;
  discount: number | null;
  service_fee: number | null;
  total_amount: number | null;
  currency: string | null;
  notes: string | null;
};

const DEFAULT_MODEL = "gemini/gemini-2.5-pro";

function getConfig() {
  // Prefer the new GATEWAY_* envs (struk-ocr style); fall back to AI_* so
  // existing deployments keep working without re-configuration.
  const apiKey = process.env.GATEWAY_API_KEY ?? process.env.AI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const baseUrl = (process.env.GATEWAY_BASE_URL ?? process.env.AI_BASE_URL ?? "").replace(/\/+$/, "");
  const model = process.env.GATEWAY_MODEL_IMAGE ?? DEFAULT_MODEL;
  return { apiKey, baseUrl, model };
}

export function isReceiptAiConfigured(): boolean {
  const { apiKey, baseUrl } = getConfig();
  return Boolean(apiKey && baseUrl);
}

const SYSTEM_PROMPT = `Anda adalah sistem OCR keuangan. Baca struk ini dan ubah menjadi data transaksi yang siap disimpan ke aplikasi keuangan. Tentukan kategori pengeluaran yang paling sesuai (Makanan, Transportasi, Belanja, Tagihan, Hiburan, Kesehatan, Pendidikan, dll). Selain struk belanja, Anda juga bisa membaca screenshot QRIS, bukti transfer bank/e-wallet, dan resi pengiriman.

Berikan hasil HANYA dalam format JSON murni tanpa markdown, tanpa backtick, tanpa penjelasan tambahan:
{
  "merchant": string | null,
  "transaction_date": string | null,
  "payment_method": string | null,
  "items": [{ "name": string, "quantity": string, "unit_price": number, "amount": number }],
  "subtotal": number | null,
  "tax": number | null,
  "discount": number | null,
  "service_fee": number | null,
  "total_amount": number | null,
  "currency": string,
  "category": string,
  "notes": string | null
}

Jangan menambahkan informasi yang tidak ada pada struk. Field yang tidak ada isi null.`;

/** Maps the model's free-text category to our internal category-hint vocabulary. */
function normalizeCategory(category: string | null): string | null {
  if (!category) return null;
  const c = category.toLowerCase();
  if (c.includes("makan") || c.includes("minum") || c.includes("food") || c.includes("kuliner")) return "Makan & Minum";
  if (c.includes("transport") || c.includes("ojek") || c.includes("bensin") || c.includes("parkir")) return "Transportasi";
  if (c.includes("belanja") || c.includes("shopping")) return "Belanja";
  if (c.includes("tagihan") || c.includes("bill") || c.includes("listrik") || c.includes("air") || c.includes("internet")) return "Tagihan";
  if (c.includes("hiburan") || c.includes("entertain")) return "Hiburan";
  if (c.includes("kesehatan") || c.includes("medic") || c.includes("apotek")) return "Kesehatan";
  if (c.includes("pendidikan") || c.includes("school") || c.includes("kursus")) return "Pendidikan";
  return category;
}

/**
 * Parse a base64 image (no data URL prefix) using the chat-completions gateway.
 * Throws on network/parse errors so the caller can surface a friendly message.
 */
export async function parseReceiptWithAi(base64Image: string, mediaType: string): Promise<ParsedReceipt> {
  const { apiKey, baseUrl, model } = getConfig();
  if (!apiKey || !baseUrl) {
    throw new Error("AI gateway not configured.");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: SYSTEM_PROMPT },
            {
              type: "image_url",
              image_url: { url: `data:${mediaType || "image/jpeg"};base64,${base64Image}` }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(cleaned);
  } catch {
    throw new Error("Gagal membaca jawaban AI.");
  }

  const totalRaw = json.total_amount;
  const total = totalRaw == null ? null : Math.round(Number(totalRaw));
  const merchant = typeof json.merchant === "string" ? json.merchant : null;
  const date = typeof json.transaction_date === "string" ? json.transaction_date : null;
  const paymentMethod = typeof json.payment_method === "string" ? json.payment_method : null;
  const categoryHint = normalizeCategory(typeof json.category === "string" ? json.category : null);

  // Items array (best-effort)
  const items: ReceiptItem[] = Array.isArray(json.items)
    ? json.items.map((item) => {
        const it = item as Record<string, unknown>;
        return {
          name: typeof it.name === "string" ? it.name : "",
          quantity: it.quantity == null ? null : String(it.quantity),
          unit_price: it.unit_price == null ? null : Number(it.unit_price),
          amount: it.amount == null ? null : Number(it.amount)
        };
      })
    : [];

  return {
    transaction_type: "expense",
    amount_minor: Number.isFinite(total) && total !== null && total > 0 ? total : 0,
    merchant_name: merchant,
    occurred_at: date,
    payment_method: paymentMethod,
    category_hint: categoryHint,

    items,
    subtotal: json.subtotal == null ? null : Number(json.subtotal),
    tax: json.tax == null ? null : Number(json.tax),
    discount: json.discount == null ? null : Number(json.discount),
    service_fee: json.service_fee == null ? null : Number(json.service_fee),
    total_amount: total,
    currency: typeof json.currency === "string" ? json.currency : null,
    notes: typeof json.notes === "string" ? json.notes : null
  };
}
