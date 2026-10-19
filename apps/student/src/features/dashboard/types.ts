// What the student dashboard shows. The API serves none of it yet (see api.ts); these shapes are
// what the screen needs, to be replaced by the generated API types once the endpoints exist.

/** The signed-in student's name, as the University records it. */
export interface StudentName {
  fullName: string;
}

/** The term the dashboard is showing. */
export interface AcademicTerm {
  /** "2025-2026" */
  academicYear: string;
  /** "Second Semester" */
  termName: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
}

export interface CalendarEvent {
  id: string;
  /** A calendar date, "2026-06-29". */
  startsOn: string;
  /** The last day of a multi-day event, or null for one day. */
  endsOn: string | null;
  title: string;
  /** More about the event, behind its info button; null when there is nothing more. */
  details: string | null;
}

export type ActivityStatus = "completed" | "pending" | "failed";

export interface ActivityItem {
  id: string;
  /** An instant in UTC, "2026-06-27T02:42:00Z". */
  occurredAt: string;
  description: string;
  status: ActivityStatus;
}
