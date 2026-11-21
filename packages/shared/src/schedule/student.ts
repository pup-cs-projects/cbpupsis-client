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

/** GET /students/me/schedule (US-STU-003). */
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

/** The signed-in student's course schedule and its PDF and iCalendar exports. */
export function createStudentScheduleApi(client: ApiClient) {
  return {
    async current(accessToken: string): Promise<StudentSchedule> {
      const body = await client.request("/students/me/schedule", { method: "GET", accessToken });
      return parseSchedule(body);
    },

    /** The whole current term, whatever the read was filtered to. */
    async export(accessToken: string, format: "pdf" | "ics"): Promise<ScheduleFile> {
      const blob = await client.requestBlob(`/students/me/schedule/export?format=${format}`, {
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
