// What the My Grades page (US-STU-004) shows. The API serves none of it yet (see useGrades.ts);
// these shapes are what the screen needs, to be replaced by the generated API types once the
// endpoints exist.

export type GradeStatus = "Passed" | "Failed" | "Incomplete" | "Dropped" | "In Progress";

/** One course's mark in a term. */
export interface GradeEntry {
  id: string;
  /** "COMP 016" */
  courseCode: string;
  /** "Web Development" */
  courseTitle: string;
  units: number;
  /** As the registrar posts it: "1.25", or "INC", "P" (pass), "D" (dropped). Null until posted. */
  finalGrade: string | null;
  status: GradeStatus;
  /** "06/24/2026", already in Manila time. Null until posted. */
  datePosted: string | null;
}

export type StandingStatus =
  "Good Standing" | "Probationary" | "Warning" | "Dismissed" | "Pending Evaluation";

/** The transcript counts two regular semesters a year. */
export type Semester = "First Semester" | "Second Semester";

/** Names a term without its grades. */
export interface TermRef {
  /** "2025–2026" */
  academicYear: string;
  semester: Semester;
}

/** A term on the transcript, with its grades. */
export interface TermGrades extends TermRef {
  termId: string;
  /** The term's GPA as the registrar computed it: "1.25". Null until every grade is in. */
  gpa: string | null;
  standingStatus: StandingStatus;
  isAppealOpen: boolean;
  /** Days left to file an appeal for this term. Null when appeals are closed. */
  appealDeadlineDays: number | null;
  grades: GradeEntry[];
}

/** Across every term. Authoritative values from the API, never recomputed here. */
export interface CumulativeSummary {
  /** "1.25", or null before the first term is graded. */
  latestGpa: string | null;
  /** "1.42" */
  cumulativeGwa: string | null;
  totalUnitsEarned: number;
  /** Which courses the GWA leaves out, as the registrar words it. */
  exclusionNote: string;
}

/** GET /grades: the signed-in student's transcript. */
export interface StudentGrades {
  summary: CumulativeSummary;
  /** The term the student first enrolled in (matriculation). */
  entryTerm: TermRef;
  /** The registrar's current term: the transcript runs up to it and never past it. */
  currentTerm: TermRef;
  /** Term records, newest first. A term with no record (a leave of absence) is simply absent. */
  terms: TermGrades[];
}
