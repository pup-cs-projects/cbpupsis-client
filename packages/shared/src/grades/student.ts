import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";

export interface GradeCourse {
  enrollmentId: string;
  code: string;
  title: string;
  units: number;
  /** "1.00" to "5.00", "Inc" (incomplete), or "W" (withdrawn). */
  finalGrade: string;
  status: "Passed" | "Failed" | "Incomplete" | "Withdrawn";
  /** ISO timestamp, UTC. */
  postedAt: string;
}

export interface GradeTerm {
  id: string;
  /** "2025-2026" */
  academicYear: string;
  /** The stored identifier: "first", "second", "summer". */
  semester: string;
}

/** GET /students/me/grades: one term's marks and its stored standing. */
export interface TermStanding {
  term: GradeTerm | null;
  /** "Good Standing", "Warning Level 1", ... or null when not evaluated. */
  academicStanding: string | null;
}

export interface TranscriptTerm {
  term: GradeTerm;
  courses: GradeCourse[];
  /** Two-place string, or null with no eligible numeric units. */
  gwa: string | null;
  completed: boolean;
}

/** GET /students/me/transcript: every term with posted marks, newest first. */
export interface Transcript {
  studentNumber: string;
  terms: TranscriptTerm[];
  cumulativeGwa: string | null;
  totalUnitsEarned: number;
}

/** The signed-in student's grades and transcript (US-STU-004). */
export function createStudentGradesApi(client: ApiClient) {
  return {
    /** The whole record: the API caps a page at 100 terms, more than any student has. */
    async transcript(accessToken: string): Promise<Transcript> {
      const body = parse.record(
        await client.request("/students/me/transcript?limit=100", { method: "GET", accessToken }),
      );
      const student = parse.record(body.student);
      return {
        studentNumber: parse.string(student.student_number),
        terms: parse.array(body.terms).map(parseTranscriptTerm),
        cumulativeGwa: parse.optionalString(body.cumulative_gwa),
        totalUnitsEarned: decimal(body.total_units_earned),
      };
    },

    /** One term's standing: the current term, or the one named. */
    async term(accessToken: string, selected?: GradeTerm): Promise<TermStanding> {
      const query = selected
        ? `?year=${encodeURIComponent(selected.academicYear)}&semester=${encodeURIComponent(selected.semester)}`
        : "";
      const body = parse.record(
        await client.request(`/students/me/grades${query}`, { method: "GET", accessToken }),
      );
      return {
        term: body.term === null || body.term === undefined ? null : parseTerm(body.term),
        academicStanding: parse.optionalString(body.academic_standing),
      };
    },
  };
}

export type StudentGradesApi = ReturnType<typeof createStudentGradesApi>;

/** Pydantic sends decimals as strings ("3.0"). */
function decimal(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : parse.invalid();
}

function parseTerm(value: unknown): GradeTerm {
  const t = parse.record(value);
  return {
    id: parse.string(t.id),
    academicYear: parse.string(t.academic_year),
    semester: parse.string(t.semester),
  };
}

function parseCourse(value: unknown): GradeCourse {
  const c = parse.record(value);
  return {
    enrollmentId: parse.string(c.enrollment_id),
    code: parse.string(c.code),
    title: parse.string(c.title),
    units: decimal(c.units),
    finalGrade: parse.string(c.final_grade),
    status: parse.oneOf(c.status, ["Passed", "Failed", "Incomplete", "Withdrawn"] as const),
    postedAt: parse.string(c.posted_at),
  };
}

function parseTranscriptTerm(value: unknown): TranscriptTerm {
  const t = parse.record(value);
  return {
    term: parseTerm(t.term),
    courses: parse.array(t.courses).map(parseCourse),
    gwa: parse.optionalString(t.gwa),
    completed: parse.boolean(t.completed),
  };
}
