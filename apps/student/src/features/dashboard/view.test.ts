import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "./types";
import { formatAmount, studentDetails, upcomingEvents } from "./view";

const event = (id: string, startsOn: string, endsOn: string | null = null): CalendarEvent => ({
  id,
  startsOn,
  endsOn,
  title: id,
  details: null,
});

describe("studentDetails (AC-STU-001.1)", () => {
  it("reads programme, year, and status in one plain line", () => {
    expect(studentDetails({ programme: "BSCS", yearLevel: 3, enrollmentStatus: "ENROLLED" })).toBe(
      "BSCS · 3rd year · Enrolled",
    );
  });

  it.each([
    [1, "1st year"],
    [2, "2nd year"],
    [3, "3rd year"],
    [4, "4th year"],
    [5, "5th year"],
    [11, "11th year"],
    [12, "12th year"],
    [21, "21st year"],
  ])("writes year %i as %s", (yearLevel, words) => {
    expect(
      studentDetails({ programme: "BSCS", yearLevel, enrollmentStatus: "ENROLLED" }),
    ).toContain(words);
  });

  it("says in words what is not on record, never leaving a blank", () => {
    const line = studentDetails({ programme: null, yearLevel: null, enrollmentStatus: null });

    expect(line).toBe("Program unavailable · Year level unavailable · Not enrolled this term");
    expect(line).not.toMatch(/null|undefined/);
  });

  it("treats an empty programme and a zero year as not on record", () => {
    expect(studentDetails({ programme: "  ", yearLevel: 0, enrollmentStatus: "ENROLLED" })).toBe(
      "Program unavailable · Year level unavailable · Enrolled",
    );
  });

  it("reads NOT_ENROLLED as not enrolled this term, and other statuses as words", () => {
    const base = { programme: "BSCS", yearLevel: 2 };

    expect(studentDetails({ ...base, enrollmentStatus: "NOT_ENROLLED" })).toBe(
      "BSCS · 2nd year · Not enrolled this term",
    );
    expect(studentDetails({ ...base, enrollmentStatus: "ON_LEAVE" })).toBe(
      "BSCS · 2nd year · On leave",
    );
  });
});

describe("upcomingEvents", () => {
  const events = [
    event("past", "2026-07-01"),
    event("ended-yesterday", "2026-08-08", "2026-08-09"),
    event("ends-today", "2026-08-08", "2026-08-10"),
    event("today", "2026-08-10"),
    event("later", "2026-09-01"),
  ];

  it("drops what ended before today and keeps what is under way or still to come", () => {
    expect(upcomingEvents(events, "2026-08-10").map((e) => e.id)).toEqual([
      "ends-today",
      "today",
      "later",
    ]);
  });

  it("puts the soonest first", () => {
    const shuffled = [event("b", "2026-09-02"), event("a", "2026-09-01")];

    expect(upcomingEvents(shuffled, "2026-08-10").map((e) => e.id)).toEqual(["a", "b"]);
  });
});

describe("formatAmount", () => {
  it("writes pesos", () => {
    expect(formatAmount(1500, "PHP")).toBe("₱1,500.00");
  });

  it("falls back to pesos for a currency code it cannot read", () => {
    expect(formatAmount(1500, "??")).toBe("₱1,500.00");
  });
});
