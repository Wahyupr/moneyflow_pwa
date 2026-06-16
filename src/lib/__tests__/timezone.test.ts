import { describe, expect, it } from "vitest";
import { currentHourInTz, todayBoundsInTz } from "../timezone";

describe("todayBoundsInTz", () => {
  it("returns the WIB calendar date for an instant that is already past midnight WIB", () => {
    // 2026-06-16T17:00:00Z = 2026-06-17T00:00:00 WIB (UTC+7).
    const bounds = todayBoundsInTz("Asia/Jakarta", new Date("2026-06-16T17:00:00Z"));

    expect(bounds.date).toBe("2026-06-17");
    expect(bounds.startUtc).toBe("2026-06-16T17:00:00.000Z");
    expect(bounds.endUtc).toBe("2026-06-17T17:00:00.000Z");
    expect(bounds.prevStartUtc).toBe("2026-06-15T17:00:00.000Z");
  });

  it("returns the WIB calendar date for an instant just before midnight WIB", () => {
    // 2026-06-16T16:59:59Z = 2026-06-16T23:59:59 WIB → still the 16th in WIB.
    const bounds = todayBoundsInTz("Asia/Jakarta", new Date("2026-06-16T16:59:59Z"));

    expect(bounds.date).toBe("2026-06-16");
    expect(bounds.startUtc).toBe("2026-06-15T17:00:00.000Z");
    expect(bounds.endUtc).toBe("2026-06-16T17:00:00.000Z");
  });

  it("treats UTC as a 1-to-1 wall-clock with no offset", () => {
    const bounds = todayBoundsInTz("UTC", new Date("2026-06-16T05:30:00Z"));

    expect(bounds.date).toBe("2026-06-16");
    expect(bounds.startUtc).toBe("2026-06-16T00:00:00.000Z");
    expect(bounds.endUtc).toBe("2026-06-17T00:00:00.000Z");
    expect(bounds.prevStartUtc).toBe("2026-06-15T00:00:00.000Z");
  });

  it("produces exactly 24h between start and end", () => {
    const bounds = todayBoundsInTz("Asia/Jakarta", new Date("2026-06-16T10:00:00Z"));
    const durMs = Date.parse(bounds.endUtc) - Date.parse(bounds.startUtc);
    expect(durMs).toBe(24 * 60 * 60 * 1000);
  });

  it("prevStartUtc is exactly 24h before startUtc", () => {
    const bounds = todayBoundsInTz("Asia/Jakarta", new Date("2026-06-16T10:00:00Z"));
    const durMs = Date.parse(bounds.startUtc) - Date.parse(bounds.prevStartUtc);
    expect(durMs).toBe(24 * 60 * 60 * 1000);
  });
});

describe("currentHourInTz", () => {
  it("returns the WIB wall-clock hour for a UTC instant", () => {
    // 2026-06-16T17:00:00Z = midnight WIB → hour 0.
    expect(currentHourInTz("Asia/Jakarta", new Date("2026-06-16T17:00:00Z"))).toBe(0);

    // 2026-06-16T01:00:00Z = 08:00 WIB.
    expect(currentHourInTz("Asia/Jakarta", new Date("2026-06-16T01:00:00Z"))).toBe(8);

    // 2026-06-16T00:00:00Z = 07:00 WIB.
    expect(currentHourInTz("Asia/Jakarta", new Date("2026-06-16T00:00:00Z"))).toBe(7);
  });

  it("returns the UTC wall-clock hour unchanged for UTC", () => {
    expect(currentHourInTz("UTC", new Date("2026-06-16T15:00:00Z"))).toBe(15);
  });
});
