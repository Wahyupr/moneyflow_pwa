/**
 * Timezone helpers for "today" calculations.
 *
 * The insight daily-limit is per calendar day in the user's local timezone
 * (default Asia/Jakarta). Postgres stores everything as timestamptz (UTC), so
 * we need to compute the UTC instants that correspond to midnight local-time.
 *
 * Implementation uses Intl.DateTimeFormat with the target tz to get the
 * wall-clock parts, then derives the UTC offset by comparing to the raw
 * epoch millis. This avoids depending on a tz database in JS (Intl has it).
 */

export type DayBounds = {
  /** YYYY-MM-DD string in the target timezone. */
  date: string;
  /** UTC ISO instant of midnight at the start of that date in the tz. */
  startUtc: string;
  /** UTC ISO instant of midnight at the end of that date in the tz. */
  endUtc: string;
  /** UTC ISO instant of midnight at the start of the previous date in the tz. */
  prevStartUtc: string;
};

function wallClockParts(timezone: string, reference: Date): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(reference);

  const out: Record<string, number> = {};
  for (const p of parts) {
    if (p.type === "hour" && p.value === "24") {
      out.hour = 0;
      continue;
    }
    if (p.type !== "literal") {
      out[p.type] = Number(p.value);
    }
  }
  return out;
}

/**
 * Returns the UTC offset of `timezone` at the given reference instant, in
 * milliseconds (positive = tz is ahead of UTC, e.g. Jakarta returns +25200000).
 */
function offsetMs(timezone: string, reference: Date): number {
  const wall = wallClockParts(timezone, reference);
  const wallAsUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second
  );
  return wallAsUtc - reference.getTime();
}

/**
 * Computes the UTC instants bounding "today" in the given timezone.
 */
export function todayBoundsInTz(
  timezone: string,
  reference: Date = new Date()
): DayBounds {
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(reference);

  const offset = offsetMs(timezone, reference);
  const [y, m, d] = dateStr.split("-").map(Number);
  const midnightWall = Date.UTC(y, m - 1, d, 0, 0, 0);
  const startUtcMs = midnightWall - offset;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  const prevStartUtcMs = startUtcMs - 24 * 60 * 60 * 1000;

  return {
    date: dateStr,
    startUtc: new Date(startUtcMs).toISOString(),
    endUtc: new Date(endUtcMs).toISOString(),
    prevStartUtc: new Date(prevStartUtcMs).toISOString()
  };
}

/**
 * Returns the current hour (0-23) in the target timezone.
 */
export function currentHourInTz(timezone: string, reference: Date = new Date()): number {
  return wallClockParts(timezone, reference).hour;
}
