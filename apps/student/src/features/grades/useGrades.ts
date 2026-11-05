import { useQuery } from "@tanstack/react-query";

import type { GradeTerm, TranscriptTerm } from "@cbpupsis/shared/grades";

import { gradesApi as api, session } from "../../lib/auth";
import type {
  GradeEntry,
  GradeStatus,
  Semester,
  StandingStatus,
  StudentGrades,
  TermGrades,
  TermRef,
} from "./gradesTypes";

const SEMESTER_LABELS: Record<string, Semester> = {
  first: "First Semester",
  second: "Second Semester",
};

/** The API's standings, in the page's fewer words. */
function standingStatus(value: string | null): StandingStatus {
  if (value === null) return "Pending Evaluation";
  if (value === "Good Standing") return "Good Standing";
  if (value.startsWith("Warning")) return "Warning";
  if (value === "Probation") return "Probationary";
  return "Dismissed"; // College Dropping, University Dismissal
}

const STATUSES: Record<string, GradeStatus> = {
  Passed: "Passed",
  Failed: "Failed",
  Incomplete: "Incomplete",
  Withdrawn: "Dropped",
};

/** "06/24/2026", in Manila time. */
const POSTED = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function termRef(term: GradeTerm): TermRef | null {
  const semester = SEMESTER_LABELS[term.semester];
  // The transcript counts two regular semesters a year; a summer term has no row on it.
  return semester ? { academicYear: term.academicYear.replace("-", "–"), semester } : null;
}

/** A PUP student number starts with the year of admission: 2021-00456-MN-0. */
function entryTermOf(studentNumber: string): TermRef {
  const year = Number.parseInt(studentNumber.slice(0, 4), 10);
  return { academicYear: `${year}–${year + 1}`, semester: "First Semester" };
}

function toTermGrades(record: TranscriptTerm, standing: string | null): TermGrades | null {
  const ref = termRef(record.term);
  if (!ref) return null;
  return {
    ...ref,
    termId: record.term.id,
    gpa: record.gwa,
    standingStatus: standingStatus(standing),
    // The API has no appeal window yet; the page says appeals are unavailable.
    isAppealOpen: false,
    appealDeadlineDays: null,
    grades: record.courses.map((course): GradeEntry => ({
      id: course.enrollmentId,
      courseCode: course.code,
      courseTitle: course.title,
      units: course.units,
      finalGrade: course.finalGrade === "Inc" ? "INC" : course.finalGrade,
      status: STATUSES[course.status] ?? "In Progress",
      datePosted: POSTED.format(new Date(course.postedAt)),
    })),
  };
}

/** The grades page's data call: the transcript, plus each listed term's stored standing. */
export const gradesApi = {
  async grades(): Promise<StudentGrades | null> {
    return session.authorized(async (token) => {
      const [transcript, current] = await Promise.all([api.transcript(token), api.term(token)]);
      // The transcript has no standing; the per-term read does.
      const standings = await Promise.all(
        transcript.terms.map((record) => api.term(token, record.term)),
      );
      const terms = transcript.terms
        .map((record, index) => toTermGrades(record, standings[index]?.academicStanding ?? null))
        .filter((term): term is TermGrades => term !== null);

      const entryTerm = entryTermOf(transcript.studentNumber);
      const currentTerm = (current.term && termRef(current.term)) ?? terms[0] ?? entryTerm;
      const latestCompleted = transcript.terms.find((record) => record.completed && record.gwa);

      return {
        summary: {
          latestGpa: latestCompleted?.gwa ?? null,
          cumulativeGwa: transcript.cumulativeGwa,
          totalUnitsEarned: transcript.totalUnitsEarned,
          exclusionNote:
            "The GWA leaves out NSTP and courses without a numeric grade (INC, W). " +
            "Terms still in progress are not counted yet.",
        },
        entryTerm,
        currentTerm,
        terms,
      };
    });
  },
};

export const gradesKeys = {
  all: ["grades"] as const,
  transcript: () => [...gradesKeys.all, "transcript"] as const,
};

// ---- The term list: entry term to current term, two semesters a year ----

const SEMESTERS: Semester[] = ["First Semester", "Second Semester"];

/** "2025–2026" (or "2025-2026") to 2025. */
function startYear(academicYear: string) {
  return Number.parseInt(academicYear, 10);
}

/** Terms in order: each academic year counts two. */
function termIndex(term: TermRef) {
  return startYear(term.academicYear) * 2 + SEMESTERS.indexOf(term.semester);
}

function termAt(index: number): TermRef {
  const year = Math.floor(index / 2);
  return { academicYear: `${year}–${year + 1}`, semester: SEMESTERS[index % 2] };
}

/**
 * Every term from the student's entry term up to the current one, newest first, each paired
 * with its record. A term with no record (nothing posted yet, or a leave of absence) still
 * gets a row, with no grades. Records after the current term are left out: they haven't
 * happened.
 */
export function transcriptTerms({ entryTerm, currentTerm, terms }: StudentGrades): TermGrades[] {
  const byIndex = new Map(terms.map((term) => [termIndex(term), term]));
  const list: TermGrades[] = [];
  for (let index = termIndex(currentTerm); index >= termIndex(entryTerm); index--) {
    const ref = termAt(index);
    list.push(
      byIndex.get(index) ?? {
        ...ref,
        termId: `term-${index}`,
        gpa: null,
        standingStatus: "Pending Evaluation",
        isAppealOpen: false,
        appealDeadlineDays: null,
        grades: [],
      },
    );
  }
  return list;
}

/** The response with `terms` replaced by the derived list. Stable, so the query memoizes it. */
function selectTranscript(data: StudentGrades | null): StudentGrades | null {
  return data && { ...data, terms: transcriptTerms(data) };
}

// The call goes through gradesApi's property at call time, so a test can stand in for it.

export function useGrades() {
  return useQuery({
    queryKey: gradesKeys.transcript(),
    queryFn: () => gradesApi.grades(),
    select: selectTranscript,
  });
}

/** The newest term with a GPA (the latest completed one): the page opens on it. */
export function latestGradedTerm(terms: TermGrades[]): TermGrades | undefined {
  return terms.find((term) => term.gpa !== null) ?? terms[0];
}

/** "Academic Year 2025–2026 Second Semester" */
export function termLabel(term: TermGrades) {
  return `Academic Year ${term.academicYear} ${term.semester}`;
}
