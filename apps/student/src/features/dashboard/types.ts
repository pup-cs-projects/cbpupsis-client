// What the student dashboard shows, shaped for the screen from GET /student/dashboard (see
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

/** An administrative or financial hold, ready to show (AC-STU-001.2). */
export interface Hold {
  type: string;
  /** The office that placed it. */
  office: string;
  description: string;
  /** What is owed, or null when nothing is or the API gave no figure. Never a default. */
  amount: number | null;
  /** An ISO 4217 code, "PHP". */
  currency: string;
  blocksEnrollment: boolean;
}

export interface Dashboard {
  /** The student's name as the University records it; null when it has none. */
  fullName: string | null;
  /** YYYY-NNNNN-XX-N; null when the University has none on record. */
  studentNumber: string | null;
  /** The profile picture's address, for the same authenticated fetch the Profile page uses. */
  avatarUrl: string | null;
  /** The programme as the University records it; null when it has none on record. */
  programme: string | null;
  /** 1 for first year; null when the University has none on record. */
  yearLevel: number | null;
  /** As the API sends it ("ENROLLED", "NOT_ENROLLED"); null when it sends none. */
  enrollmentStatus: string | null;
  term: AcademicTerm | null;
  /** Null when the API could not say, which is not the same as none: holds are then unknown. */
  holds: Hold[] | null;
  announcements: Announcement[];
  events: CalendarEvent[];
  recentActivity: ActivityItem[];
  emptyMessages: EmptyMessages;
}
