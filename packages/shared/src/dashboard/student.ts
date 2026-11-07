import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";

export interface DashboardStudent {
  studentNumber: string | null;
  /** Null when the University has no name on record. Never derived from the email. */
  name: string | null;
  programme: string | null;
  yearLevel: number;
  /** "ENROLLED", "NOT_ENROLLED", ... as the API sends it. */
  enrollmentStatus: string;
  avatarUrl: string | null;
}

export interface DashboardTerm {
  /** "2026-2027" */
  academicYear: string;
  /** As stored: "first" or "First Semester". */
  semester: string;
}

export interface DashboardAnnouncement {
  id: string;
  title: string;
  body: string;
  /** An instant, ISO 8601. */
  publishedAt: string;
  isPinned: boolean;
}

export interface DashboardEvent {
  id: string;
  title: string;
  /** Instants, ISO 8601. */
  startsAt: string;
  endsAt: string;
  isMultiDay: boolean;
  description: string | null;
}

export type DashboardActivitySeverity = "success" | "info" | "warning";

export interface DashboardActivity {
  id: string;
  /** An instant, ISO 8601 with its offset. */
  occurredAt: string;
  /** "LOGIN_SUCCESS", "ENROLLMENT", ... */
  type: string;
  severity: DashboardActivitySeverity;
  description: string;
}

/** What to say in a section the API returned empty, or null when it has items. */
export interface DashboardEmptyStates {
  announcements: string | null;
  events: string | null;
  recentActivity: string | null;
}

/**
 * GET /student/me/dashboard (US-101): the signed-in student's landing view in one call.
 * Only the sections a screen shows are read; the rest of the response is ignored.
 */
export interface StudentDashboard {
  student: DashboardStudent;
  /** Null when no term is set up yet. */
  currentTerm: DashboardTerm | null;
  announcements: DashboardAnnouncement[];
  events: DashboardEvent[];
  recentActivity: DashboardActivity[];
  emptyStates: DashboardEmptyStates;
}

/** The signed-in student's dashboard. */
export function createStudentDashboardApi(client: ApiClient) {
  return {
    async me(accessToken: string): Promise<StudentDashboard> {
      const body = await client.request("/student/me/dashboard", { method: "GET", accessToken });
      return parseDashboard(parse.record(body).data);
    },
  };
}

export type StudentDashboardApi = ReturnType<typeof createStudentDashboardApi>;

/**
 * The dashboard fills a missing value with "" rather than leaving it out (a student with no
 * programme yet, a term not set up), so an empty string here means "not set", not drift.
 */
function blank(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return parse.string(value);
}

function parseStudent(value: unknown): DashboardStudent {
  const s = parse.record(value);
  const studentNumber = blank(s.student_number);
  const name = blank(s.name);
  return {
    studentNumber,
    // With no name on record the API falls back to the student number, which is not a name.
    name: name === studentNumber ? null : name,
    programme: blank(s.programme),
    yearLevel: parse.nonNegativeInteger(s.year_level),
    enrollmentStatus: parse.string(s.enrollment_status),
    avatarUrl: blank(s.avatar_url),
  };
}

function parseTerm(value: unknown): DashboardTerm | null {
  const t = parse.record(value);
  const academicYear = blank(t.academic_year);
  const semester = blank(t.semester);
  // With no term set up, the API sends a placeholder with both left empty.
  return academicYear && semester ? { academicYear, semester } : null;
}

function parseAnnouncement(value: unknown): DashboardAnnouncement {
  const a = parse.record(value);
  return {
    id: parse.string(a.id),
    title: parse.string(a.title),
    body: parse.string(a.body),
    publishedAt: parse.string(a.published_at),
    isPinned: parse.boolean(a.is_pinned),
  };
}

function parseEvent(value: unknown): DashboardEvent {
  const e = parse.record(value);
  return {
    id: parse.string(e.id),
    title: parse.string(e.title),
    startsAt: parse.string(e.starts_at),
    endsAt: parse.string(e.ends_at),
    isMultiDay: parse.boolean(e.is_multi_day),
    description: blank(e.description),
  };
}

const SEVERITY = { SUCCESS: "success", INFO: "info", WARNING: "warning" } as const;

function parseActivity(value: unknown): DashboardActivity {
  const a = parse.record(value);
  return {
    id: parse.string(a.id),
    occurredAt: parse.string(a.occurred_at),
    type: parse.string(a.type),
    severity: SEVERITY[parse.oneOf(a.severity, ["SUCCESS", "INFO", "WARNING"] as const)],
    description: parse.string(a.description),
  };
}

function parseDashboard(value: unknown): StudentDashboard {
  const d = parse.record(value);
  const empty = parse.record(d.empty_states);
  return {
    student: parseStudent(d.student),
    currentTerm: parseTerm(d.current_term),
    announcements: parse.array(d.announcements).map(parseAnnouncement),
    events: parse.array(d.events).map(parseEvent),
    recentActivity: parse.array(d.recent_activity).map(parseActivity),
    emptyStates: {
      announcements: blank(empty.announcements),
      events: blank(empty.events),
      recentActivity: blank(empty.recent_activity),
    },
  };
}
