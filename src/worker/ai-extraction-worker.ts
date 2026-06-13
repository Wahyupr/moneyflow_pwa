import { buildDuplicateFingerprint } from "@/lib/extraction";
import { buildExtractionPrompt, parseExtractionJson } from "@/lib/ai/extraction";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const pollIntervalMs = Number(process.env.AI_WORKER_POLL_INTERVAL_MS ?? 5000);
const model = process.env.AI_EXTRACTION_MODEL ?? "gpt-5.5";

async function runOnce() {
  const supabase = createSupabaseServiceClient();
  const { data: job, error } = await supabase
    .from("ai_extraction_jobs")
    .select("*, file_ingestions(object_key)")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !job) {
    return;
  }

  await supabase.from("ai_extraction_jobs").update({ status: "processing", attempts: job.attempts + 1 }).eq("id", job.id);

  try {
    const { data: signedUrl, error: signedUrlError } = await supabase.storage
      .from("transaction-evidence")
      .createSignedUrl(job.file_ingestions.object_key, 60);

    if (signedUrlError || !signedUrl?.signedUrl) {
      throw new Error(signedUrlError?.message ?? "Unable to create signed evidence URL.");
    }

    const extracted = await extractWithOpenAI({
      documentType: job.document_type,
      signedUrl: signedUrl.signedUrl
    });
    const fingerprint = buildDuplicateFingerprint({
      userId: job.user_id,
      fileSha256: job.file_sha256,
      referenceNumber: extracted.reference_number ?? null,
      amountMinor: extracted.amount_minor ?? null,
      occurredAt: extracted.occurred_at ?? null
    });

    await supabase.from("transaction_drafts").insert({
      job_id: job.id,
      user_id: job.user_id,
      ingestion_id: job.ingestion_id,
      duplicate_fingerprint: fingerprint,
      extracted_json: extracted,
      status: "pending_review"
    });
    await supabase.from("ai_extraction_jobs").update({ status: "succeeded" }).eq("id", job.id);
  } catch (caught) {
    await supabase
      .from("ai_extraction_jobs")
      .update({
        status: job.attempts + 1 >= 3 ? "failed" : "queued",
        error_message: caught instanceof Error ? caught.message : "Unknown extraction error"
      })
      .eq("id", job.id);
  }
}

async function extractWithOpenAI(input: { documentType: "qris" | "bank_transfer" | "ewallet_transfer" | "receipt" | "unknown"; signedUrl: string }) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: buildExtractionPrompt(input.documentType) },
            { type: "input_image", image_url: input.signedUrl }
          ]
        }
      ],
      text: {
        format: { type: "json_object" }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI extraction failed with status ${response.status}.`);
  }

  const json = await response.json();
  const text = json.output_text ?? json.output?.[0]?.content?.[0]?.text;

  if (typeof text !== "string") {
    throw new Error("OpenAI extraction response did not include text output.");
  }

  return parseExtractionJson(text) as {
    document_type?: string;
    amount_minor?: number;
    occurred_at?: string;
    reference_number?: string;
  };
}

async function main() {
  for (;;) {
    await runOnce();
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

if (process.env.RUN_AI_WORKER === "true") {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
