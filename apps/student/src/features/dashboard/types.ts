// What the student dashboard shows, shaped for the screen from GET /student/me/dashboard (see
// api.ts). The API's own shapes live in @cbpupsis/shared/dashboard.

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
  /** A calendar date in Manila, "2026-06-29". */
  startsOn: string;
  /** The last day of a multi-day event, or null for one day. */
  endsOn: string | null;
  title: string;
  /** More about the event, behind its info button; null when there is nothing more. */
  details: string | null;
}

export type ActivityStatus = "success" | "info" | "warning";

export interface ActivityItem {
  id: string;
  /** An instant, "2026-06-27T10:42:00+08:00". */
  occurredAt: string;
  description: string;
  status: ActivityStatus;
}

/** Each section's message for when it has nothing to show. */
export interface EmptyMessages {
  announcements: string;
  events: string;
  recentActivity: string;
}

export interface Dashboard {
  /** The student's name as the University records it; null when it has none. */
  fullName: string | null;
  /** YYYY-NNNNN-XX-N; null when the University has none on record. */
  studentNumber: string | null;
  /** The profile picture's address, for the same authenticated fetch the Profile page uses. */
  avatarUrl: string | null;
  term: AcademicTerm | null;
  announcements: Announcement[];
  events: CalendarEvent[];
  recentActivity: ActivityItem[];
  emptyMessages: EmptyMessages;
}
