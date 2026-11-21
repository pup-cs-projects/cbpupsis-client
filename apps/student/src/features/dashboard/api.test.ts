import type { StudentDashboard } from "@cbpupsis/shared/dashboard";
import { describe, expect, it } from "vitest";

import { toDashboard } from "./api";

function dashboard(overrides: Partial<StudentDashboard> = {}): StudentDashboard {
  return {
    student: {
      studentNumber: "2021-00456-MN-0",
      name: "Juan A. Dela Cruz",
      programme: "BS Computer Science",
      yearLevel: 3,
      enrollmentStatus: "ENROLLED",
      avatarUrl: null,
    },
    currentTerm: { academicYear: "2026-2027", semester: "first" },
    announcements: [],
    events: [],
    recentActivity: [],
    emptyStates: { announcements: null, events: null, recentActivity: null },
    ...overrides,
  };
}

const event = {
  id: "e1",
  title: "Start of classes",
  startsAt: "2026-08-17T00:00:00+08:00",
  endsAt: "2026-08-17T23:59:00+08:00",
  isMultiDay: false,
  description: null,
};

describe("shaping the API's dashboard for the screen", () => {
  it("names the term in words, whichever way it is stored", () => {
    expect(toDashboard(dashboard()).term).toEqual({
      academicYear: "2026-2027",
      termName: "First Semester",
    });
    const stored = dashboard({
      currentTerm: { academicYear: "2026-2027", semester: "Summer Term" },
    });
    expect(toDashboard(stored).term?.termName).toBe("Summer Term");
  });

  it("shows no name and no term when the University has none on record", () => {
    const view = toDashboard(
      dashboard({ student: { ...dashboard().student, name: null }, currentTerm: null }),
    );

    expect(view.fullName).toBeNull();
    expect(view.term).toBeNull();
  });

  it("dates an event by the day it falls on in Manila", () => {
    // 11 PM UTC on June 28 is already June 29 in Manila.
    const late = { ...event, startsAt: "2026-06-28T23:00:00Z", endsAt: "2026-06-28T23:30:00Z" };

    expect(toDashboard(dashboard({ events: [late] })).events[0]).toMatchObject({
      startsOn: "2026-06-29",
      endsOn: null,
    });
  });

  it("gives a multi-day event its last day, and a one-day event none", () => {
    const week = {
      ...event,
      startsAt: "2026-10-26T00:00:00+08:00",
      endsAt: "2026-10-30T17:00:00+08:00",
      isMultiDay: true,
    };

    const [multi, single] = toDashboard(dashboard({ events: [week, event] })).events;

    expect(multi).toMatchObject({ startsOn: "2026-10-26", endsOn: "2026-10-30" });
    expect(single).toMatchObject({ startsOn: "2026-08-17", endsOn: null });
  });

  it("uses the API's empty-state words, with its own when the API sends none", () => {
    const view = toDashboard(
      dashboard({
        emptyStates: { announcements: "Nothing posted yet.", events: null, recentActivity: null },
      }),
    );

    expect(view.emptyMessages.announcements).toBe("Nothing posted yet.");
    expect(view.emptyMessages.events).toBe("No upcoming events on the academic calendar.");
  });

  it("keeps each activity's status from its severity", () => {
    const view = toDashboard(
      dashboard({
        recentActivity: [
          {
            id: "r1",
            occurredAt: "2026-07-21T09:15:00+08:00",
            type: "LOGIN_FAILED",
            severity: "warning",
            description: "Failed sign-in attempt",
          },
        ],
      }),
    );

    expect(view.recentActivity).toEqual([
      {
        id: "r1",
        occurredAt: "2026-07-21T09:15:00+08:00",
        description: "Failed sign-in attempt",
        status: "warning",
      },
    ]);
  });
});
