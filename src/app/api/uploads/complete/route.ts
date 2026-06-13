import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { buildExtractionJob } from "@/lib/api-contracts";

export const runtime = "nodejs";

const CompleteUploadSchema = z.object({
  ingestion_id: z.string().uuid(),
  object_key: z.string().min(1),
  document_type: z.enum(["qris", "bank_transfer", "ewallet_transfer", "receipt", "unknown"]),
  file_sha256: z.string().min(8)
});

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const parsed = CompleteUploadSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload completion payload." }, { status: 400 });
  }

  const ingestion = {
    id: parsed.data.ingestion_id,
    user_id: auth.user.id,
    object_key: parsed.data.object_key,
    document_type: parsed.data.document_type,
    file_sha256: parsed.data.file_sha256,
    status: "uploaded"
  };
  const job = buildExtractionJob({
    ingestionId: parsed.data.ingestion_id,
    userId: auth.user.id,
    documentType: parsed.data.document_type,
    fileSha256: parsed.data.file_sha256
  });

  const { error: ingestionError } = await auth.supabase.from("file_ingestions").insert(ingestion);

  if (ingestionError) {
    return NextResponse.json({ error: ingestionError.message }, { status: 500 });
  }

  const { data, error: jobError } = await auth.supabase
    .from("ai_extraction_jobs")
    .insert(job)
    .select("id, ingestion_id, status, attempts")
    .single();

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  return NextResponse.json({ ingestion, job: data }, { status: 201 });
}
