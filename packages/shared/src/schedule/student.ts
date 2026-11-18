import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";

export interface ScheduleMeeting {
  /** Monday = 0 ... Sunday = 6. */
  dayOfWeek: number;
  /** Manila wall-clock "HH:mm". */
  startTime: string;
  endTime: string;
  room: string | null;
  type: "lecture" | "laboratory";
}

export interface ScheduleCourse {
  sectionId: string;
  code: string;
  title: string;
  room: string | null;
  facultyName: string | null;
  units: number;
  meetings: ScheduleMeeting[];
}

export interface ScheduleTerm {
  /** "2026-2027" */
  year: string;
  /** The stored identifier: "first", "second", "summer". */
  semester: string;
}

/** GET /student/schedule (US-STU-003). */
export interface StudentSchedule {
  term: ScheduleTerm | null;
  courses: ScheduleCourse[];
  totalCredits: number;
  state: "ready" | "notEnrolled" | "noMatches" | "termUnavailable";
  message: string | null;
}

export interface ScheduleFile {
  blob: Blob;
  filename: string;
}

/** Supported schedule namespaces during the student API path migration. */
export type StudentSchedulePath = "/student/schedule" | "/students/me/schedule";

/** The signed-in student's course schedule and its PDF and iCalendar exports. */
export function createStudentScheduleApi(
  client: ApiClient,
  schedulePath: StudentSchedulePath = "/student/schedule",
) {
  return {
    googleCalendar: createGoogleCalendarApi(client, schedulePath),
    async current(accessToken: string): Promise<StudentSchedule> {
      const body = await client.request(schedulePath, { method: "GET", accessToken });
      return parseSchedule(body);
    },

    /** The whole current term, whatever the read was filtered to. */
    async export(accessToken: string, format: "pdf" | "ics"): Promise<ScheduleFile> {
      const blob = await client.requestBlob(`${schedulePath}/export?format=${format}`, {
        accessToken,
      });
      return { blob, filename: `course-schedule.${format}` };
    },
  };
}

export type StudentScheduleApi = ReturnType<typeof createStudentScheduleApi>;

/** Pydantic sends decimals as strings ("3.0"); a number is accepted too. */
function decimal(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : parse.invalid();
}

/** "07:30:00" -> "07:30". */
function clock(value: unknown): string {
  const match = /^(\d{2}):(\d{2})/.exec(parse.string(value));
  return match ? `${match[1]}:${match[2]}` : parse.invalid();
}

function parseMeeting(value: unknown): ScheduleMeeting {
  const m = parse.record(value);
  const day = parse.nonNegativeInteger(m.day_of_week);
  return {
    dayOfWeek: day <= 6 ? day : parse.invalid(),
    startTime: clock(m.start_time),
    endTime: clock(m.end_time),
    room: parse.optionalString(m.room),
    type: parse.oneOf(m.type, ["lecture", "laboratory"] as const),
  };
}

function parseCourse(value: unknown): ScheduleCourse {
  const c = parse.record(value);
  return {
    sectionId: parse.string(c.section_id),
    code: parse.string(c.code),
    title: parse.string(c.title),
    room: parse.optionalString(c.room),
    facultyName: parse.optionalString(c.faculty_name),
    units: decimal(c.units),
    meetings: parse.array(c.meetings).map(parseMeeting),
  };
}

function parseSchedule(value: unknown): StudentSchedule {
  const body = parse.record(value);
  const term =
    body.term === null || body.term === undefined
      ? null
      : (() => {
          const t = parse.record(body.term);
          return { year: parse.string(t.year), semester: parse.string(t.semester) };
        })();
  return {
    term,
    courses: parse.array(body.courses).map(parseCourse),
    totalCredits: decimal(body.total_credits),
    state: parse.oneOf(body.state, [
      "ready",
      "notEnrolled",
      "noMatches",
      "termUnavailable",
    ] as const),
    message: parse.optionalString(body.message),
  };
}

export interface GoogleCalendarTarget extends ScheduleTerm {
  provisioned: boolean;
}

/** Only public connection fields. Google credentials and IDs are never retained. */
export interface GoogleCalendarConnection {
  enabled: boolean;
  connected: boolean;
  disconnecting: boolean;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  lastError: string | null;
  targets: GoogleCalendarTarget[];
}

export interface GoogleCalendarAuthorization {
  authorizationUrl: string;
  expiresIn: number;
}

export interface GoogleCalendarCallback {
  state: string;
  code: string;
}

function termSelection(term?: ScheduleTerm): ScheduleTerm | Record<string, never> {
  if (!term) return {};
  const year = parse.string(term.year).trim();
  const semester = parse.string(term.semester).trim();
  if (!year || year.length > 20 || !semester || semester.length > 30) return parse.invalid();
  return { year, semester };
}

function timestamp(value: unknown): string | null {
  const result = parse.optionalString(value);
  return result === null || Number.isFinite(Date.parse(result)) ? result : parse.invalid();
}

function parseConnection(value: unknown): GoogleCalendarConnection {
  const body = parse.record(value);
  const targets = parse.array(body.targets ?? []).map((value) => {
    const target = parse.record(value);
    return {
      year: parse.string(target.year),
      semester: parse.string(target.semester),
      provisioned: parse.boolean(target.provisioned),
    };
  });
  if (
    targets.length > 10 ||
    new Set(targets.map((t) => JSON.stringify([t.year, t.semester]))).size !== targets.length
  )
    return parse.invalid();
  return {
    enabled: parse.boolean(body.enabled),
    connected: parse.boolean(body.connected ?? false),
    disconnecting: parse.boolean(body.disconnecting ?? false),
    lastSyncAt: timestamp(body.last_sync_at),
    nextSyncAt: timestamp(body.next_sync_at),
    lastError: parse.optionalString(body.last_error),
    targets,
  };
}

function parseAuthorization(value: unknown): GoogleCalendarAuthorization {
  const body = parse.record(value);
  const authorizationUrl = parse.string(body.authorization_url);
  let url: URL;
  try {
    url = new URL(authorizationUrl);
  } catch {
    return parse.invalid();
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "accounts.google.com" ||
    url.port ||
    url.username ||
    url.password ||
    !url.pathname.startsWith("/o/oauth2/")
  )
    return parse.invalid();
  return { authorizationUrl, expiresIn: parse.positiveNumber(body.expires_in ?? 600) };
}

function createGoogleCalendarApi(client: ApiClient, schedulePath: StudentSchedulePath) {
  const calendarPath = `${schedulePath}/google-calendar`;
  return {
    async status(accessToken: string, signal?: AbortSignal): Promise<GoogleCalendarConnection> {
      return parseConnection(
        await client.request(calendarPath, { method: "GET", accessToken, signal }),
      );
    },
    async authorize(
      accessToken: string,
      term?: ScheduleTerm,
    ): Promise<GoogleCalendarAuthorization> {
      return parseAuthorization(
        await client.request(`${calendarPath}/authorization`, {
          method: "POST",
          body: termSelection(term),
          accessToken,
        }),
      );
    },
    async callback(
      accessToken: string,
      payload: GoogleCalendarCallback,
    ): Promise<GoogleCalendarConnection> {
      // Do not retry or persist a consumed OAuth code/state. Session auth may refresh a 401.
      return parseConnection(
        await client.request(`${calendarPath}/callback`, {
          method: "POST",
          body: { state: payload.state, code: payload.code },
          accessToken,
          // The provider exchange has a documented 25-second server deadline.
          timeoutMs: 35_000,
        }),
      );
    },
    async sync(accessToken: string, term?: ScheduleTerm): Promise<GoogleCalendarConnection> {
      return parseConnection(
        await client.request(`${calendarPath}/sync`, {
          method: "POST",
          body: termSelection(term),
          accessToken,
        }),
      );
    },
    async disconnect(accessToken: string): Promise<GoogleCalendarConnection> {
      return parseConnection(await client.request(calendarPath, { method: "DELETE", accessToken }));
    },
  };
}
