import { describe, expect, it } from "vitest";

import { formatClockTime, formatEventDates, formatTimestamp, manilaWeekday } from "./datetime";

describe("event dates", () => {
  it("shows one day in full", () => {
    expect(formatEventDates("2026-06-29")).toBe("June 29, 2026");
    expect(formatEventDates("2026-06-29", "2026-06-29")).toBe("June 29, 2026");
  });

  it("shows a range within a year with the year once", () => {
    expect(formatEventDates("2026-06-29", "2026-07-01")).toBe("June 29 - July 1, 2026");
  });

  it("shows both years for a range across a new year", () => {
    expect(formatEventDates("2026-12-28", "2027-01-02")).toBe(
      "December 28, 2026 - January 2, 2027",
    );
  });
});

describe("timestamps", () => {
  it("shows an instant in Manila, 8 hours ahead of UTC", () => {
    expect(formatTimestamp("2026-06-27T02:42:00Z")).toBe("June 27, 2026 • 10:42 AM");
    // 20:15 UTC on June 26 is already June 27 in Manila.
    expect(formatTimestamp("2026-06-26T20:15:00Z")).toBe("June 27, 2026 • 4:15 AM");
  });
});

describe("class times", () => {
  it("reads 24-hour wall-clock times as 12-hour", () => {
    expect(formatClockTime("07:30")).toBe("7:30 AM");
    expect(formatClockTime("12:00")).toBe("12:00 PM");
    expect(formatClockTime("00:05")).toBe("12:05 AM");
    expect(formatClockTime("16:00")).toBe("4:00 PM");
  });

  it("names today's weekday in Manila", () => {
    // 17:00 UTC on a Sunday is already Monday in Manila.
    expect(manilaWeekday(new Date("2026-10-25T17:00:00Z"))).toBe("Mon");
  });
});
