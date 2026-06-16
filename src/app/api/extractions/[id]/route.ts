import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const { id } = await context.params;
  const { data: job, error: jobError } = await auth.db
    .from("ai_extraction_jobs")
    .select("id, ingestion_id, status, attempts, error_message, created_at, updated_at")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .single();

  if (jobError) {
    return NextResponse.json({ error: jobError.message }, { status: 404 });
  }

  const { data: draft } = await auth.db
    .from("transaction_drafts")
    .select("*")
    .eq("job_id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  return NextResponse.json({ job, draft });
}
