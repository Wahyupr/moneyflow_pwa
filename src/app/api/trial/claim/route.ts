/**
 * POST /api/trial/claim
 *
 * One-time claim of the 7-day Premium free trial. New users start on the free
 * plan; they explicitly opt in via the post-registration popup which calls this
 * endpoint. Eligibility requires:
 *   1. profiles.trial_claimed_at IS NULL  (never claimed before), AND
 *   2. no active paid entitlement          (don't downgrade a paying user).
 *
 * On success we:
 *   - upsert an active `premium` entitlement ending 7 days out,
 *   - stamp profiles.trial_claimed_at, and
 *   - write a notification_logs entry so it shows up in the notifications page.
 *
 * The whole thing is idempotent — a second call returns { claimed: false }.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/api/auth";
import { query } from "@/lib/db/pool";

export const runtime = "nodejs";

const TRIAL_TITLE = "Selamat! 🎉";
const TRIAL_BODY = "Akun Anda telah berhasil di-upgrade ke Premium. Semua fitur premium sekarang aktif.";

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request);
  if ("response" in auth) return auth.response;

  const userId = auth.user.id;

  try {
    // Guard 1: has the user already claimed?
    const { rows: profileRows } = await query<{ trial_claimed_at: string | null }>(
      "select trial_claimed_at from profiles where id = $1",
      [userId]
    );

    if (profileRows[0]?.trial_claimed_at) {
      return NextResponse.json({ claimed: false, reason: "already_claimed" }, { status: 200 });
    }

    // Guard 2: does the user already have an active (paid) entitlement? If so,
    // don't overwrite it with a trial.
    const { rows: entRows } = await query<{ plan: string }>(
      `select plan from subscription_entitlements
       where user_id = $1 and status = 'active'
         and (current_period_end is null or current_period_end > now())
       limit 1`,
      [userId]
    );

    if (entRows.length > 0) {
      // Still mark as claimed so we stop offering the trial.
      await query("update profiles set trial_claimed_at = now() where id = $1", [userId]);
      return NextResponse.json({ claimed: false, reason: "already_premium" }, { status: 200 });
    }

    // Grant the trial: 7-day active premium entitlement.
    await query(
      `insert into subscription_entitlements (user_id, plan, status, current_period_end)
       values ($1, 'premium', 'active', now() + interval '7 days')
       on conflict (user_id) do update
         set plan = 'premium',
             status = 'active',
             current_period_end = now() + interval '7 days'`,
      [userId]
    );

    // Mark the trial as claimed so it can never be claimed again.
    await query("update profiles set trial_claimed_at = now() where id = $1", [userId]);

    // Log the "welcome to premium" notification (best-effort — never fail the
    // claim if the log insert has trouble).
    try {
      await query(
        `insert into notification_logs (user_id, title, body, url)
         values ($1, $2, $3, $4)`,
        [userId, TRIAL_TITLE, TRIAL_BODY, "/dashboard"]
      );
    } catch {
      // Ignore notification logging failures.
    }

    return NextResponse.json({ claimed: true, plan: "premium" }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengaktifkan trial." },
      { status: 503 }
    );
  }
}
