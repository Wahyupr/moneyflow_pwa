import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

export type AdminPaymentOrder = {
  id: string;
  order_id: string;
  user_id: string;
  display_name: string | null;
  plan: string;
  billing_cycle: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "expired";
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin(request);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const status   = searchParams.get("status");   // optional filter
  const plan     = searchParams.get("plan");      // optional filter
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit    = 50;
  const offset   = (page - 1) * limit;

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status) {
      params.push(status);
      conditions.push(`po.status = $${params.length}`);
    }
    if (plan) {
      params.push(plan);
      conditions.push(`po.plan = $${params.length}`);
    }

    const where = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";

    // Total count
    const countResult = await query<{ count: string }>(
      `select count(*) as count
       from payment_orders po
       ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

    // Paginated rows joined with profiles
    const dataParams = [...params, limit, offset];
    const result = await query<AdminPaymentOrder>(
      `select
         po.id,
         po.order_id,
         po.user_id,
         p.display_name,
         po.plan,
         po.billing_cycle,
         po.amount,
         po.status,
         po.payment_method,
         po.paid_at,
         po.created_at
       from payment_orders po
       left join profiles p on p.id = po.user_id
       ${where}
       order by po.created_at desc
       limit $${dataParams.length - 1} offset $${dataParams.length}`,
      dataParams
    );

    // Summary stats (always over all rows, ignoring pagination/filter)
    const statsResult = await query<{
      total_revenue: string;
      paid_count: string;
      pending_count: string;
      failed_count: string;
    }>(
      `select
         coalesce(sum(case when status = 'paid' then amount else 0 end), 0) as total_revenue,
         count(case when status = 'paid'    then 1 end)::text as paid_count,
         count(case when status = 'pending' then 1 end)::text as pending_count,
         count(case when status in ('failed','expired') then 1 end)::text as failed_count
       from payment_orders`
    );

    const stats = statsResult.rows[0];

    return NextResponse.json({
      orders: result.rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      stats: {
        total_revenue: parseInt(stats?.total_revenue ?? "0", 10),
        paid_count:    parseInt(stats?.paid_count    ?? "0", 10),
        pending_count: parseInt(stats?.pending_count ?? "0", 10),
        failed_count:  parseInt(stats?.failed_count  ?? "0", 10),
      },
    });
  } catch (err) {
    console.error("[admin/payments GET]", err);
    return NextResponse.json({ error: "Gagal memuat data pembayaran." }, { status: 500 });
  }
}
