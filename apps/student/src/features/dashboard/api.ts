import type { DashboardTerm, StudentDashboard } from "@cbpupsis/shared/dashboard";

import { session, studentDashboardApi } from "../../lib/auth";
import { calendarDateInManila } from "../../lib/datetime";
import { humanizeActivity } from "./activityCopy";
import type { Dashboard } from "./types";

// Used when the API leaves a section's message out, so an empty section never reads as blank.
const FALLBACK_EMPTY = {
  announcements: "No announcements at this time.",
  events: "No upcoming events on the academic calendar.",
  recentActivity: "Your account activity will appear here once you begin using the portal.",
};

// Terms are stored either as an identifier ("first") or already as words ("First Semester").
const SEMESTER_NAMES: Record<string, string> = {
  first: "First Semester",
  second: "Second Semester",
  summer: "Summer Term",
};

function termName(term: DashboardTerm) {
  return SEMESTER_NAMES[term.semester.toLowerCase()] ?? term.semester;
}

/** Shape the API's dashboard for the screen. */
export function toDashboard(data: StudentDashboard): Dashboard {
  return {
    fullName: data.student.name,
    studentNumber: data.student.studentNumber,
    avatarUrl: data.student.avatarUrl,
    programme: data.student.programme,
    yearLevel: data.student.yearLevel,
    enrollmentStatus: data.student.enrollmentStatus,
    holds:
      data.holds &&
      data.holds.map((hold) => ({
        type: hold.type,
        office: hold.office,
        description: hold.description,
        amount: hold.amountOutstanding,
        currency: hold.currency,
        blocksEnrollment: hold.blocksEnrollment,
      })),
    term: data.currentTerm && {
      academicYear: data.currentTerm.academicYear,
      termName: termName(data.currentTerm),
    },
    announcements: data.announcements.map(({ id, title, body }) => ({ id, title, body })),
    events: data.events.map((event) => {
      const startsOn = calendarDateInManila(event.startsAt);
      const endsOn = calendarDateInManila(event.endsAt);
      return {
        id: event.id,
        startsOn,
        endsOn: event.isMultiDay && endsOn !== startsOn ? endsOn : null,
        title: event.title,
        details: event.description,
      };
    }),
    recentActivity: data.recentActivity.map((item) => ({
      id: item.id,
      occurredAt: item.occurredAt,
      // Raw codes and event keys never reach the screen (see activityCopy.ts).
      description: humanizeActivity(item),
      status: item.severity,
    })),
    emptyMessages: {
      announcements: data.emptyStates.announcements ?? FALLBACK_EMPTY.announcements,
      events: data.emptyStates.events ?? FALLBACK_EMPTY.events,
      recentActivity: data.emptyStates.recentActivity ?? FALLBACK_EMPTY.recentActivity,
    },
  };
}

/** The dashboard's one call: GET /student/dashboard, through the portal's session. */
export const dashboardApi = {
  async get(): Promise<Dashboard> {
    return toDashboard(await session.authorized((token) => studentDashboardApi.me(token)));
  },
};
