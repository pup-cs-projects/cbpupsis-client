import type { FacultyIncomplete, GradingSection } from "@cbpupsis/shared/grades";
import type { FacultyGradeSheet } from "../features/grades/gradingMode";
import type { FacultyGradingDataSource } from "../features/grades/dataSource";

export const gradingSection: GradingSection = {
  id: "section-1",
  courseCode: "COMP 016",
  courseTitle: "Web Development",
  sectionName: "BSCS 2-1",
  termLabel: "2026–2027 · First Semester",
  studentCount: 3,
};
export const gradingSheet: FacultyGradeSheet = {
  section: gradingSection,
  gradingMode: "NUMERIC",
  allowedMarks: [
    "1.00",
    "1.25",
    "1.50",
    "1.75",
    "2.00",
    "2.25",
    "2.50",
    "2.75",
    "3.00",
    "5.00",
    "INC",
  ],
  state: "DRAFT",
  version: 1,
  savedAt: null,
  finalizedAt: null,
  rows: [
    {
      studentId: "student-1",
      studentNumber: "2026-00001",
      studentName: "Ana Santos",
      mark: "1.50",
      completionDeadline: null,
    },
    {
      studentId: "student-2",
      studentNumber: "2026-00002",
      studentName: "Luis Reyes",
      mark: null,
      completionDeadline: null,
    },
    {
      studentId: "student-3",
      studentNumber: "2026-00003",
      studentName: "Carlo Cruz",
      mark: "INC",
      completionDeadline: "2027-11-12T01:00:00Z",
    },
  ],
};
export const incompleteCase: FacultyIncomplete = {
  id: "inc-1",
  studentName: "Carlo Cruz",
  studentNumber: "2026-00003",
  section: gradingSection,
  completionDeadline: "2027-11-12T01:00:00Z",
  daysLeft: 365,
  state: "PENDING_COMPLETION",
  completionPending: false,
};

/** Only tests and temporary visual QA import this in-memory implementation. */
export function createGradingFixtureSource(): FacultyGradingDataSource {
  let sheet = structuredClone(gradingSheet);
  let items = [structuredClone(incompleteCase)];
  return {
    sections: async () => [structuredClone(gradingSection)],
    sheet: async () => structuredClone(sheet),
    deadline: async () => ({ deadline: "2026-12-15T15:59:00Z", passed: false }),
    saveDraft: async (_id, input) => {
      sheet = {
        ...sheet,
        version: sheet.version + 1,
        savedAt: "2026-11-12T01:00:00Z",
        rows: sheet.rows.map((row) => {
          const entry = input.grades.find((value) => value.studentId === row.studentId);
          return {
            ...row,
            mark: entry?.mark ?? null,
            completionDeadline: entry?.mark === "INC" ? "2027-11-12T01:00:00Z" : null,
          };
        }),
      };
      return structuredClone(sheet);
    },
    finalize: async () => {
      sheet = {
        ...sheet,
        state: "FINAL",
        version: sheet.version + 1,
        finalizedAt: "2026-11-12T01:05:00Z",
      };
      return {
        state: "FINAL",
        version: sheet.version,
        finalizedAt: sheet.finalizedAt,
        recordsCommitted: sheet.rows.length,
        notificationsQueued: sheet.rows.length,
      };
    },
    incompletes: async () => structuredClone(items),
    complete: async (id) => {
      items = items.map((item) => (item.id === id ? { ...item, completionPending: true } : item));
      return { id: "completion-1", state: "PENDING_DEAN" };
    },
  };
}
