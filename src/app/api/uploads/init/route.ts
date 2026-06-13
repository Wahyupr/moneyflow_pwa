import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { buildEvidenceObjectKey } from "@/lib/api-contracts";
import { validateUploadRequest } from "@/lib/upload";

export const runtime = "nodejs";

const InitUploadSchema = z.object({
  document_type: z.enum(["qris", "bank_transfer", "ewallet_transfer", "receipt", "unknown"]),
  file_name: z.string().min(1),
  content_type: z.string().min(1),
  size_bytes: z.number().int().positive()
});

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const parsed = InitUploadSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload initialization payload." }, { status: 400 });
  }

  const validation = validateUploadRequest(parsed.data);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 422 });
  }

  const ingestionId = randomUUID();
  const objectKey = buildEvidenceObjectKey({
    userId: auth.user.id,
    ingestionId,
    fileName: parsed.data.file_name
  });
  const { data, error } = await auth.supabase.storage.from("transaction-evidence").createSignedUploadUrl(objectKey);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ingestion_id: ingestionId,
    object_key: objectKey,
    upload: data
  });
}
