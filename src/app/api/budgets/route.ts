import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const BudgetCreateSchema = z.object({
  category_id: z.string().uuid(),
  amount_limit_minor: z.number().int().min(1),
  period: z.enum(["monthly", "weekly"]).default("monthly"),
  alert_at_percent: z.number().int().min(1).max(100).default(80)
});

// GET /api/budgets — list all active budgets for the authenticated user
export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const result = await query<{
    id: string;
    category_id: string;
    category_name: string;
    category_color: string;
    category_icon: string;
    amount_limit_minor: string;
    period: string;
    alert_at_percent: number;
    is_active: boolean;
    created_at: string;
  }>(
    `select b.id, b.category_id, b.amount_limit_minor, b.period, b.alert_at_percent, b.is_active, b.created_at,
            coalesce(c.name, 'Budget') as category_name,
            coalesce(c.color, '#888888') as category_color,
            coalesce(c.icon, 'tag') as category_icon
     from budgets b
     left join categories c on c.id = b.category_id
     where b.user_id = $1 and b.is_active = true
     order by b.created_at asc`,
    [auth.user.id]
  );

  const budgets = result.rows.map((row) => ({
    ...row,
    amount_limit_minor: Number(row.amount_limit_minor)
  }));

  return NextResponse.json({ budgets });
}

// POST /api/budgets — create a new budget
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const parsed = BudgetCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid budget payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const { category_id, amount_limit_minor, period, alert_at_percent } = parsed.data;

  // Verify the category exists (user-owned or system)
  const catCheck = await query<{ id: string }>(
    `select id from categories where id = $1 and (user_id = $2 or is_system = true)`,
    [category_id, auth.user.id]
  );
  if (catCheck.rows.length === 0) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  // Deactivate any existing budget for same category + period
  await query(
    `update budgets set is_active = false
     where user_id = $1 and category_id = $2 and period = $3 and is_active = true`,
    [auth.user.id, category_id, period]
  );

  const result = await query<{ id: string }>(
    `insert into budgets (user_id, category_id, amount_limit_minor, period, alert_at_percent, is_active)
     values ($1, $2, $3, $4, $5, true)
     returning id`,
    [auth.user.id, category_id, amount_limit_minor, period, alert_at_percent]
  );

  return NextResponse.json({ budget: { id: result.rows[0].id } }, { status: 201 });
}
