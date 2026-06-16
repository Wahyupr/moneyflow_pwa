/**
 * Helpers for the reminders / recurring rules feature.
 *
 * `recurring_rules.next_run_at` holds the upcoming due date in UTC. We compute
 * "days until due" from the user's current time and trigger reminders at the
 * canonical milestones (D-5, D-3, D-1, due today, overdue).
 */

export type ReminderRow = {
  id: string;
  user_id: string;
  wallet_id: string;
  category_id: string | null;
  merchant_id: string | null;
  name: string | null;
  amount_minor: number | string;
  currency: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  day_of_month: number | null;
  day_of_week: number | null;
  next_run_at: string;
  remind_days_before: number;
  is_active: boolean;
  last_paid_at: string | null;
};

export type ReminderViewModel = ReminderRow & {
  amount_minor: number;
  days_until: number;
  /** A semantic bucket for UI styling and notifications. */
  status: "overdue" | "due_today" | "due_soon" | "upcoming" | "scheduled";
  /** True when the user has already paid this period. */
  paid_for_current_period: boolean;
};

const DAY_MS = 86_400_000;

/** Whole days between two ISO dates, ignoring time-of-day. */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  // Normalize to midnight UTC so DST changes don't bias the count.
  const aMid = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const bMid = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((bMid - aMid) / DAY_MS);
}

/** Picks the urgency bucket for a reminder. */
export function bucketStatus(daysUntil: number): ReminderViewModel["status"] {
  if (daysUntil < 0) return "overdue";
  if (daysUntil === 0) return "due_today";
  if (daysUntil <= 3) return "due_soon";
  if (daysUntil <= 5) return "upcoming";
  return "scheduled";
}

/** Whether the rule was already paid for the period that ends at `next_run_at`. */
export function isPaidThisPeriod(rule: ReminderRow): boolean {
  if (!rule.last_paid_at) return false;
  return new Date(rule.last_paid_at).getTime() >= new Date(rule.next_run_at).getTime() - 7 * DAY_MS;
}

/** Advance `next_run_at` by the rule's frequency. */
export function advanceNextRun(currentIso: string, frequency: ReminderRow["frequency"]): string {
  const date = new Date(currentIso);
  switch (frequency) {
    case "daily":
      date.setUTCDate(date.getUTCDate() + 1);
      break;
    case "weekly":
      date.setUTCDate(date.getUTCDate() + 7);
      break;
    case "monthly":
      date.setUTCMonth(date.getUTCMonth() + 1);
      break;
    case "yearly":
      date.setUTCFullYear(date.getUTCFullYear() + 1);
      break;
  }
  return date.toISOString();
}

/** Builds the view model the API returns to the client. */
export function toViewModel(rule: ReminderRow, now = new Date()): ReminderViewModel {
  const daysUntil = daysBetween(now.toISOString(), rule.next_run_at);
  return {
    ...rule,
    amount_minor: Number(rule.amount_minor),
    days_until: daysUntil,
    status: bucketStatus(daysUntil),
    paid_for_current_period: isPaidThisPeriod(rule)
  };
}
