import { buildDuplicateFingerprint } from "@/lib/extraction";
import { buildExtractionPrompt, parseExtractionJson } from "@/lib/ai/extraction";
import { query } from "@/lib/db/pool";

const pollIntervalMs = Number(process.env.AI_WORKER_POLL_INTERVAL_MS ?? 5000);
const model = process.env.AI_EXTRACTION_MODEL ?? "gpt-5.5";

type JobRow = {
  id: string;
  user_id: string;
  ingestion_id: string;
  document_type: "qris" | "bank_transfer" | "ewallet_transfer" | "receipt" | "unknown";
  file_sha256: string;
  attempts: number;
  object_key: string;
};

/**
 * Resolves an evidence object key to a URL the OpenAI API can read. Object
 * storage is not part of the self-hosted Postgres setup, so this must be wired
 * to your S3-compatible store (e.g. MinIO) before the worker can run.
 */
async function resolveEvidenceUrl(_objectKey: string): Promise<string> {
  throw new Error("Evidence storage is not configured for the self-hosted deployment.");
}

async function runOnce() {
  const result = await query<JobRow>(
    `select j.id, j.user_id, j.ingestion_id, j.document_type, j.file_sha256, j.attempts, i.object_key
     from ai_extraction_jobs j
     join file_ingestions i on i.id = j.ingestion_id
     where j.status = 'queued'
     order by j.created_at asc
     limit 1`
  );
  const job = result.rows[0];

  if (!job) {
    return;
  }

  await query("update ai_extraction_jobs set status = 'processing', attempts = $2 where id = $1", [
    job.id,
    job.attempts + 1
  ]);

  try {
    const evidenceUrl = await resolveEvidenceUrl(job.object_key);

    const extracted = await extractWithOpenAI({
      documentType: job.document_type,
      signedUrl: evidenceUrl
    });
    const fingerprint = buildDuplicateFingerprint({
      userId: job.user_id,
      fileSha256: job.file_sha256,
      referenceNumber: extracted.reference_number ?? null,
      amountMinor: extracted.amount_minor ?? null,
      occurredAt: extracted.occurred_at ?? null
    });

    await query(
      `insert into transaction_drafts (job_id, user_id, ingestion_id, duplicate_fingerprint, extracted_json, status)
       values ($1, $2, $3, $4, $5, 'pending_review')`,
      [job.id, job.user_id, job.ingestion_id, fingerprint, JSON.stringify(extracted)]
    );
    await query("update ai_extraction_jobs set status = 'succeeded' where id = $1", [job.id]);
  } catch (caught) {
    await query("update ai_extraction_jobs set status = $2, error_message = $3 where id = $1", [
      job.id,
      job.attempts + 1 >= 3 ? "failed" : "queued",
      caught instanceof Error ? caught.message : "Unknown extraction error"
    ]);
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
