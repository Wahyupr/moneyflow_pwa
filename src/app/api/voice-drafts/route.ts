import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { buildVoiceDraftInsert } from "@/lib/drafts";

export const runtime = "nodejs";

const VoiceDraftSchema = z.object({
  transcript: z.string().min(1),
  occurred_at: z.string().datetime().optional()
});

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const parsed = VoiceDraftSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Transcript is required." }, { status: 400 });
  }

  const insert = buildVoiceDraftInsert({
    userId: auth.user.id,
    transcript: parsed.data.transcript,
    occurredAt: parsed.data.occurred_at ?? new Date().toISOString()
  });
  const { data, error } = await auth.supabase.from("transaction_drafts").insert(insert).select("*").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ draft: data }, { status: 201 });
}
