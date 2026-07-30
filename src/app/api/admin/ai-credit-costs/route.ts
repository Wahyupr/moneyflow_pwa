import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const CostSchema = z.object({
  action: z.enum(["voice", "scan", "insight", "chat"]),
  credits: z.number().int().nonnegative()
});

export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin(request);
  if ("response" in auth) return auth.response;

  try {
    const result = await query(`select action, credits, label, updated_at from ai_credit_costs order by action`);
    return NextResponse.json({ costs: result.rows });
  } catch (err) {
    console.error("[admin/ai-credit-costs GET]", err);
    return NextResponse.json({ error: "Failed to fetch credit costs." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiAdmin(request);
  if ("response" in auth) return auth.response;

  const parsed = CostSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await query(
      `update ai_credit_costs
       set credits = $2, updated_at = now()
       where action = $1
       returning action, credits, label, updated_at`,
      [parsed.data.action, parsed.data.credits]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Unknown action." }, { status: 404 });
    }
    return NextResponse.json({ cost: result.rows[0] });
  } catch (err) {
    console.error("[admin/ai-credit-costs PUT]", err);
    return NextResponse.json({ error: "Failed to update credit cost." }, { status: 500 });
  }
}
