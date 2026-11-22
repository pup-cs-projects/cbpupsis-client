import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";

export interface DashboardStudent {
  studentNumber: string | null;
  /** Null when the University has no name on record. Never derived from the email. */
  name: string | null;
  /** Null when the student has no programme on record. */
  programme: string | null;
  /** Null when the API sends no year level, or one that is not a year (0). */
  yearLevel: number | null;
  /** "ENROLLED", "NOT_ENROLLED", ... as the API sends it; null when it sends none. */
  enrollmentStatus: string | null;
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

/**
 * An administrative or financial hold on the student's account (AC-STU-001.2). The amount is
 * null when none is owed or the API sends none, so the screen never invents one.
 */
export interface DashboardHold {
  /** "FINANCIAL", "ACADEMIC", ... as the API sends it. */
  type: string;
  /** The office that placed the hold: "Cashier", "Registrar". */
  office: string;
  description: string;
  /** What is still owed, in `currency`; null when nothing is owed or the API sent no figure. */
  amountOutstanding: number | null;
  /** An ISO 4217 code; "PHP" unless the API says otherwise. */
  currency: string;
  blocksEnrollment: boolean;
}

/** What to say in a section the API returned empty, or null when it has items. */
export interface DashboardEmptyStates {
  announcements: string | null;
  events: string | null;
  recentActivity: string | null;
}

/**
 * GET /student/dashboard (US-101): the signed-in student's landing view in one call.
 * Only the sections a screen shows are read; the rest of the response is ignored.
 */
export interface StudentDashboard {
  student: DashboardStudent;
  /** Null when no term is set up yet. */
  currentTerm: DashboardTerm | null;
  /**
   * Empty when the student has none. Null when the section is missing or unreadable, which is
   * not the same as none: the student's holds are then unknown, and the screen says so.
   */
  holds: DashboardHold[] | null;
  announcements: DashboardAnnouncement[];
  events: DashboardEvent[];
  recentActivity: DashboardActivity[];
  emptyStates: DashboardEmptyStates;
}

/**
 * How many events and activity items to ask for. The API defaults to 10 and allows 50; the
 * screen shows three of each and offers the rest (a calendar, 90 days of activity) on demand.
 */
const SECTION_LIMIT = 50;
const PATH = `/student/dashboard?eventLimit=${SECTION_LIMIT}&activityLimit=${SECTION_LIMIT}`;

/** The signed-in student's dashboard. */
export function createStudentDashboardApi(client: ApiClient) {
  return {
    async me(accessToken: string): Promise<StudentDashboard> {
      const body = await client.request(PATH, { method: "GET", accessToken });
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
    // The API fills a missing year level with 0 or leaves it out; neither is a year.
    yearLevel: typeof s.year_level === "number" && s.year_level >= 1 ? s.year_level : null,
    enrollmentStatus: blank(s.enrollment_status),
    avatarUrl: blank(s.avatar_url),
  };
}

/** "1500.00" → 1500; null for anything that is not a positive figure. */
function amount(value: unknown): number | null {
  const figure = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(figure) && figure > 0 ? figure : null;
}

function parseHold(value: unknown): DashboardHold {
  const h = parse.record(value);
  return {
    type: blank(h.type) ?? "HOLD",
    // A hold must never vanish for want of a label: say plainly that the API gave none.
    office: blank(h.office) ?? "Office not specified",
    description: blank(h.description) ?? "No details provided.",
    amountOutstanding: amount(h.amount_outstanding),
    currency: blank(h.currency) ?? "PHP",
    // A hold blocks enrollment unless the API says otherwise.
    blocksEnrollment: h.blocks_enrollment === false ? false : true,
  };
}

/**
 * Holds are read on their own: a missing or unreadable section yields null (holds unknown)
 * instead of failing the whole dashboard, so the rest of the page still loads.
 */
function parseHolds(value: unknown): DashboardHold[] | null {
  if (!Array.isArray(value)) return null;
  try {
    return value.map(parseHold);
  } catch {
    return null;
  }
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
    holds: parseHolds(d.holds),
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
