/*
 * FICTIONAL, DEVELOPMENT-ONLY DATA. Nothing here is a real student's record.
 *
 * It lets `npm run dev` look like the mockup while the API has no grades endpoint.
 * useGrades.ts reads it only when import.meta.env.DEV is true; a production build replaces that
 * flag with false, so this module is dropped from the bundle.
 *
 * Delete it when GET /grades lands (see the TODO(api) note in useGrades.ts).
 */
import type { CumulativeSummary, StudentGrades, TermRef } from "./gradesTypes";

const EXCLUSION_NOTE = "Excludes non-credit courses (NSTP, PATHFIT) from GWA computation.";

/** The mock registrar's current term. Grades for it are posted, so its appeal window is open. */
const CURRENT_TERM: TermRef = { academicYear: "2025–2026", semester: "Second Semester" };

// Newest term first, as the API will send them.
export const MOCK_GRADES: StudentGrades = {
  entryTerm: { academicYear: "2024–2025", semester: "First Semester" },
  currentTerm: CURRENT_TERM,
  summary: {
    latestGpa: "1.25",
    cumulativeGwa: "1.42",
    totalUnitsEarned: 104,
    exclusionNote: EXCLUSION_NOTE,
  },
  terms: [
    {
      termId: "mock-2025-2",
      academicYear: "2025–2026",
      semester: "Second Semester",
      gpa: "1.25",
      standingStatus: "Good Standing",
      isAppealOpen: true,
      appealDeadlineDays: 14,
      grades: [
        {
          id: "mock-grade-2025-2-1",
          courseCode: "COMP 016",
          courseTitle: "Web Development",
          units: 3,
          finalGrade: "1.00",
          status: "Passed",
          datePosted: "06/24/2026",
        },
        {
          id: "mock-grade-2025-2-2",
          courseCode: "COMP 020",
          courseTitle: "Information Assurance and Security",
          units: 3,
          finalGrade: "1.25",
          status: "Passed",
          datePosted: "06/24/2026",
        },
        {
          id: "mock-grade-2025-2-3",
          courseCode: "COMP 021",
          courseTitle: "Mobile Application Development",
          units: 3,
          finalGrade: "1.50",
          status: "Passed",
          datePosted: "06/23/2026",
        },
        {
          id: "mock-grade-2025-2-4",
          courseCode: "COSC 304",
          courseTitle: "Automata Theory and Formal Languages",
          units: 3,
          finalGrade: "1.25",
          status: "Passed",
          datePosted: "06/22/2026",
        },
        {
          id: "mock-grade-2025-2-5",
          courseCode: "COSC 361",
          courseTitle: "CS Thesis Writing 1",
          units: 3,
          finalGrade: "1.25",
          status: "Passed",
          datePosted: "06/24/2026",
        },
        {
          id: "mock-grade-2025-2-6",
          courseCode: "PATHFIT 4",
          courseTitle: "Physical Activity Towards Health and Fitness 4",
          units: 2,
          finalGrade: "P",
          status: "Passed",
          datePosted: "06/20/2026",
        },
      ],
    },
    {
      termId: "mock-2025-1",
      academicYear: "2025–2026",
      semester: "First Semester",
      gpa: "1.50",
      standingStatus: "Good Standing",
      isAppealOpen: false,
      appealDeadlineDays: null,
      grades: [
        {
          id: "mock-grade-2025-1-1",
          courseCode: "COSC 306",
          courseTitle: "Software Engineering 1",
          units: 3,
          finalGrade: "1.25",
          status: "Passed",
          datePosted: "01/16/2026",
        },
        {
          id: "mock-grade-2025-1-2",
          courseCode: "COSC 308",
          courseTitle: "Modeling and Simulation",
          units: 3,
          finalGrade: "INC",
          status: "Incomplete",
          datePosted: "01/16/2026",
        },
        {
          id: "mock-grade-2025-1-3",
          courseCode: "GEED 007",
          courseTitle: "Science, Technology and Society",
          units: 3,
          finalGrade: "1.75",
          status: "Passed",
          datePosted: "01/15/2026",
        },
        {
          id: "mock-grade-2025-1-4",
          courseCode: "GEED 032",
          courseTitle: "Filipinolohiya at Pambansang Kaunlaran",
          units: 3,
          finalGrade: "D",
          status: "Dropped",
          datePosted: "10/03/2025",
        },
      ],
    },
    {
      termId: "mock-2024-2",
      academicYear: "2024–2025",
      semester: "Second Semester",
      gpa: "1.75",
      standingStatus: "Good Standing",
      isAppealOpen: false,
      appealDeadlineDays: null,
      grades: [
        {
          id: "mock-grade-2024-2-1",
          courseCode: "COSC 210",
          courseTitle: "Design and Analysis of Algorithms",
          units: 3,
          finalGrade: "1.50",
          status: "Passed",
          datePosted: "06/18/2025",
        },
        {
          id: "mock-grade-2024-2-2",
          courseCode: "MATH 104",
          courseTitle: "Numerical Methods",
          units: 3,
          finalGrade: "5.00",
          status: "Failed",
          datePosted: "06/18/2025",
        },
        {
          id: "mock-grade-2024-2-3",
          courseCode: "NSTP 2",
          courseTitle: "National Service Training Program 2",
          units: 3,
          finalGrade: "P",
          status: "Passed",
          datePosted: "06/12/2025",
        },
      ],
    },
    {
      termId: "mock-2024-1",
      academicYear: "2024–2025",
      semester: "First Semester",
      gpa: "1.75",
      standingStatus: "Good Standing",
      isAppealOpen: false,
      appealDeadlineDays: null,
      grades: [
        {
          id: "mock-grade-2024-1-1",
          courseCode: "COMP 001",
          courseTitle: "Introduction to Computing",
          units: 3,
          finalGrade: "1.50",
          status: "Passed",
          datePosted: "01/17/2025",
        },
        {
          id: "mock-grade-2024-1-2",
          courseCode: "COMP 002",
          courseTitle: "Computer Programming 1",
          units: 3,
          finalGrade: "1.75",
          status: "Passed",
          datePosted: "01/17/2025",
        },
        {
          id: "mock-grade-2024-1-3",
          courseCode: "GEED 004",
          courseTitle: "Mathematics in the Modern World",
          units: 3,
          finalGrade: "2.00",
          status: "Passed",
          datePosted: "01/16/2025",
        },
        {
          id: "mock-grade-2024-1-4",
          courseCode: "NSTP 1",
          courseTitle: "National Service Training Program 1",
          units: 3,
          finalGrade: "P",
          status: "Passed",
          datePosted: "01/10/2025",
        },
      ],
    },
  ],
};

const EMPTY_SUMMARY: CumulativeSummary = {
  latestGpa: null,
  cumulativeGwa: null,
  totalUnitsEarned: 0,
  exclusionNote: EXCLUSION_NOTE,
};

/** A new student: enrolled this term, nothing graded yet. Open /grades?preview=empty. */
export const MOCK_GRADES_EMPTY: StudentGrades = {
  summary: EMPTY_SUMMARY,
  entryTerm: CURRENT_TERM,
  currentTerm: CURRENT_TERM,
  terms: [],
};
