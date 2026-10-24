import { useQuery } from "@tanstack/react-query";

import { MOCK_GRADES, MOCK_GRADES_EMPTY } from "./gradesMocks";
import type { Semester, StudentGrades, TermGrades, TermRef } from "./gradesTypes";

/*
 * The grades page's data call. No endpoint exists for it yet.
 *
 * As in dashboard/api.ts, the call reads import.meta.env.DEV inline, so a production build folds
 * it to the empty branch and drops gradesMocks.ts from the bundle. When the endpoint lands, its
 * call goes in packages/shared (CONVENTIONS: data flow), parsed at the boundary, and the
 * function here calls it through the portal's session; then delete the mock.
 */
export const gradesApi = {
  // TODO(api): GET /grades: the signed-in student's transcript (every term, newest first) with
  // the cumulative summary. GPA, GWA, standing, and the appeal window are the registrar's
  // values; the client displays them and never recomputes them.
  async grades(): Promise<StudentGrades | null> {
    if (!import.meta.env.DEV) return null;
    return devPreview(MOCK_GRADES);
  },
};

/**
 * Dev only: `/grades?preview=empty|error|loading` shows the page's other states without an API.
 * Lives inside the DEV branch above, so production never reads it.
 */
function devPreview(grades: StudentGrades): Promise<StudentGrades> {
  const preview = new URLSearchParams(window.location.search).get("preview");
  if (preview === "empty") return Promise.resolve(MOCK_GRADES_EMPTY);
  if (preview === "error") return Promise.reject(new Error("Preview: grades failed to load."));
  if (preview === "loading") return new Promise(() => {});
  return Promise.resolve(grades);
}

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
