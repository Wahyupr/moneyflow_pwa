import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

// Nullable int: empty string → null (unlimited), number string → number
const NullableInt = z
  .union([z.literal(""), z.literal(null), z.number().int().nonnegative()])
  .nullable()
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v));

const PlanLimitsSchema = z.object({
  plan: z.enum(["free", "premium", "pro"]),
  wallets: NullableInt,
  active_budgets: NullableInt,
  history_months: NullableInt,
  voice_per_day: NullableInt,
  scan_per_day: NullableInt,
  export_per_month: NullableInt,
  ai_insights_per_month: NullableInt,
  debt_records: NullableInt,
  shared_wallets: NullableInt,
  reminders: NullableInt,
  custom_merchants: NullableInt,
  custom_categories: NullableInt,
  ai_chat: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin(request);
  if ("response" in auth) return auth.response;

  try {
    const result = await query(`select * from plan_limits order by plan`);
    return NextResponse.json({ limits: result.rows });
  } catch (err) {
    console.error("[admin/plan-limits GET]", err);
    return NextResponse.json({ error: "Failed to fetch plan limits." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireApiAdmin(request);
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = PlanLimitsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { plan, ...fields } = parsed.data;

  // Collect columns and values for upsert
  const columns: string[] = ["plan", "updated_at"];
  const values: unknown[] = [plan, new Date().toISOString()];
  let idx = 3;

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      columns.push(key);
      values.push(value);
      idx++;
    }
  }

  const colList = columns.join(", ");
  const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
  const updateSet = columns
    .slice(1) // skip "plan" (conflict key)
    .map((col) => `${col} = excluded.${col}`)
    .join(", ");

  try {
    const result = await query(
      `insert into plan_limits (${colList})
       values (${placeholders})
       on conflict (plan)
       do update set ${updateSet}
       returning *`,
      values
    );

    return NextResponse.json({ limit: result.rows[0] });
  } catch (err) {
    console.error("[admin/plan-limits PUT]", err);
    return NextResponse.json({ error: "Failed to update plan limits." }, { status: 500 });
  }
}
