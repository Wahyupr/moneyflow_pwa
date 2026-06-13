import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { createConfirmedTransactionPayload } from "@/lib/api-contracts";
import { normalizeExtractionDraft } from "@/lib/extraction";

export const runtime = "nodejs";

const ConfirmDraftSchema = z.object({
  wallet_id: z.string().uuid(),
  category_id: z.string().uuid().nullable().optional(),
  reviewed: z.boolean().default(false),
  note: z.string().max(500).nullable().optional()
});

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser(request);

  if ("response" in auth) {
    return auth.response;
  }

  const parsed = ConfirmDraftSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid draft confirmation payload." }, { status: 400 });
  }

  const { id } = await context.params;
  const { data: draftRecord, error: draftError } = await auth.supabase
    .from("transaction_drafts")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .single();

  if (draftError || !draftRecord) {
    return NextResponse.json({ error: draftError?.message ?? "Draft not found." }, { status: 404 });
  }

  const normalizedDraft = normalizeExtractionDraft(draftRecord.extracted_json);
  const reviewedDraft = parsed.data.reviewed ? { ...normalizedDraft, needs_review: false } : normalizedDraft;

  try {
    const transactionPayload = createConfirmedTransactionPayload({
      draft: reviewedDraft,
      userId: auth.user.id,
      walletId: parsed.data.wallet_id,
      categoryId: parsed.data.category_id,
      note: parsed.data.note,
      inputMethod: draftRecord.input_method
    });
    const { data: transaction, error: insertError } = await auth.supabase
      .from("transactions")
      .insert(transactionPayload)
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await auth.supabase.from("transaction_drafts").update({ status: "confirmed" }).eq("id", id).eq("user_id", auth.user.id);

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Draft cannot be confirmed." }, { status: 422 });
  }
}
