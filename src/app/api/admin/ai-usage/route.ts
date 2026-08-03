import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiAdmin } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

/**
 * Aggregated AI-credit usage for the admin monitoring dashboard:
 *  - totals for today and the last 30 days
 *  - breakdown by action (last 30 days)
 *  - daily trend (last 14 days)
 *  - top consumers (last 30 days)
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAdmin(request);
  if ("response" in auth) return auth.response;

  try {
    const [today, month, byAction, trend, topUsers] = await Promise.all([
      query<{ credits: string | null; calls: string }>(
        `select coalesce(sum(credits), 0)::text as credits, count(*)::text as calls
         from ai_credit_ledger
         where created_at >= date_trunc('day', now())`
      ),
      query<{ credits: string | null; calls: string }>(
        `select coalesce(sum(credits), 0)::text as credits, count(*)::text as calls
         from ai_credit_ledger
         where created_at >= now() - interval '30 days'`
      ),
      query<{ action: string; credits: string | null; calls: string }>(
        `select action, coalesce(sum(credits), 0)::text as credits, count(*)::text as calls
         from ai_credit_ledger
         where created_at >= now() - interval '30 days'
         group by action
         order by sum(credits) desc`
      ),
      query<{ day: string; credits: string | null; calls: string }>(
        `select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
                coalesce(sum(credits), 0)::text as credits,
                count(*)::text as calls
         from ai_credit_ledger
         where created_at >= now() - interval '14 days'
         group by 1
         order by 1`
      ),
      query<{ user_id: string; display_name: string | null; credits: string | null; calls: string }>(
        `select l.user_id,
                p.display_name,
                coalesce(sum(l.credits), 0)::text as credits,
                count(*)::text as calls
         from ai_credit_ledger l
         left join profiles p on p.id = l.user_id
         where l.created_at >= now() - interval '30 days'
         group by l.user_id, p.display_name
         order by sum(l.credits) desc
         limit 10`
      )
    ]);

    return NextResponse.json({
      today: {
        credits: Number(today.rows[0]?.credits ?? 0),
        calls: Number(today.rows[0]?.calls ?? 0)
      },
      month: {
        credits: Number(month.rows[0]?.credits ?? 0),
        calls: Number(month.rows[0]?.calls ?? 0)
      },
      byAction: byAction.rows.map((r) => ({
        action: r.action,
        credits: Number(r.credits ?? 0),
        calls: Number(r.calls)
      })),
      trend: trend.rows.map((r) => ({
        day: r.day,
        credits: Number(r.credits ?? 0),
        calls: Number(r.calls)
      })),
      topUsers: topUsers.rows.map((r) => ({
        user_id: r.user_id,
        display_name: r.display_name,
        credits: Number(r.credits ?? 0),
        calls: Number(r.calls)
      }))
    });
  } catch (err) {
    console.error("[admin/ai-usage GET]", err);
    return NextResponse.json({ error: "Failed to fetch AI usage." }, { status: 500 });
  }
}
