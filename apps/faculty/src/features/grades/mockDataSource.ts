import { ApiError } from "@cbpupsis/shared/api";
import { GradeValidationError, normalizeGrade } from "@cbpupsis/shared/grades";
import type { FacultyGradingDataSource } from "./dataSource";
type Sheet = Awaited<ReturnType<FacultyGradingDataSource["sheet"]>> & {
  gradingMode: "NUMERIC" | "PASS_FAIL";
  allowedMarks: string[];
};
const numericMarks = [
  "1.00",
  "1.25",
  "1.50",
  "1.75",
  "2.00",
  "2.25",
  "2.50",
  "2.75",
  "3.00",
  "4.00",
  "5.00",
  "INC",
];
/** SAMPLE_FACULTY_GRADES: development only; never imports test fixtures or stores real grades. */
export function createMockFacultyGradingDataSource(
  includePassFail = false,
  scenario = import.meta.env.VITE_FEATURE_MOCK_SCENARIO ?? "ready",
): FacultyGradingDataSource {
  const now = Date.now();
  const deadline = new Date(now + (scenario === "closed" ? -1 : 7) * 86400000).toISOString();
  let firstRead = true;
  function read(signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (scenario === "error" && firstRead) {
      firstRead = false;
      throw new ApiError(503, "SAMPLE_SERVICE_UNAVAILABLE");
    }
  }
  const sections = [
    {
      id: "sample-computing",
      courseCode: "COMP 016",
      courseTitle: "Web Development",
      sectionName: "BSCS 3-1",
      termLabel: "2026–2027 · First Semester",
      studentCount: 3,
    },
    {
      id: "sample-final",
      courseCode: "COMP 021",
      courseTitle: "Software Engineering",
      sectionName: "BSCS 3-2",
      termLabel: "2026–2027 · First Semester",
      studentCount: 3,
    },
    ...(includePassFail
      ? [
          {
            id: "sample-nstp",
            courseCode: "NSTP 002",
            courseTitle: "National Service Training Program",
            sectionName: "BSCS 1-1",
            termLabel: "2026–2027 · First Semester",
            studentCount: 3,
          },
        ]
      : []),
  ];
  const sheets = new Map<string, Sheet>(
    sections.map((section) => {
      const pass = section.id === "sample-nstp";
      const final = section.id === "sample-final";
      return [
        section.id,
        {
          section,
          gradingMode: pass ? "PASS_FAIL" : "NUMERIC",
          allowedMarks: pass ? ["PASS", "FAIL"] : numericMarks,
          state: final ? "FINAL" : "DRAFT",
          version: 1,
          savedAt: null,
          finalizedAt: final ? new Date(now).toISOString() : null,
          rows: ["Ana Santos", "Luis Reyes", "Carlo Cruz"].map((studentName, index) => ({
            studentId: "sample-student-" + index,
            studentNumber: "2026-0000" + (index + 1) + "-DM-0",
            studentName,
            mark:
              index === 1 && !final
                ? null
                : pass
                  ? index === 2
                    ? "FAIL"
                    : "PASS"
                  : index === 2 && !final
                    ? "INC"
                    : "1.75",
            completionDeadline:
              index === 2 && !pass && !final ? new Date(now + 300 * 86400000).toISOString() : null,
          })),
        },
      ];
    }),
  );
  const get = (id: string) => {
    const sheet = sheets.get(id);
    if (!sheet) throw new ApiError(404, "RESOURCE_NOT_FOUND");
    return sheet;
  };
  const check = (id: string, version: number) => {
    const sheet = get(id);
    if (sheet.state === "FINAL") throw new ApiError(409, "GRADES_LOCKED");
    if (sheet.version !== version) throw new ApiError(409, "VERSION_CONFLICT");
    return sheet;
  };
  const incompletes = [
    {
      id: "sample-inc",
      studentName: "Carlo Cruz",
      studentNumber: "2026-00003-DM-0",
      section: sections[0]!,
      completionDeadline: new Date(now + 300 * 86400000).toISOString(),
      daysLeft: 300,
      state: "PENDING_COMPLETION" as const,
      completionPending: false,
    },
  ];
  return {
    sections: async (signal) => {
      read(signal);
      return scenario === "empty" ? [] : structuredClone(sections);
    },
    sheet: async (id, signal) => {
      read(signal);
      const sheet = structuredClone(get(id));
      if (scenario === "empty") sheet.rows = [];
      return sheet;
    },
    deadline: async (id) => {
      get(id);
      return { deadline, passed: Date.parse(deadline) <= Date.now() };
    },
    saveDraft: async (id, input) => {
      const sheet = check(id, input.version);
      const errors: Record<string, string> = {};
      const rows = sheet.rows.map((row) => {
        const entry = input.grades.find((item) => item.studentId === row.studentId);
        const raw = entry?.mark ?? null;
        const normalized =
          raw === null
            ? null
            : sheet.gradingMode === "PASS_FAIL"
              ? ["PASS", "FAIL"].includes(raw)
                ? raw
                : null
              : normalizeGrade(raw);
        if (raw !== null && (!normalized || !sheet.allowedMarks.includes(normalized)))
          errors[row.studentId] = "Choose an allowed mark for this section.";
        return { ...row, mark: normalized };
      });
      if (Object.keys(errors).length) throw new GradeValidationError(errors);
      const saved = {
        ...sheet,
        rows,
        version: sheet.version + 1,
        savedAt: new Date().toISOString(),
      };
      sheets.set(id, saved);
      return structuredClone(saved);
    },
    finalize: async (id, version) => {
      const sheet = check(id, version);
      if (Date.parse(deadline) <= Date.now()) throw new ApiError(403, "GRADE_DEADLINE_PASSED");
      if (sheet.rows.some((row) => !row.mark))
        throw new GradeValidationError(
          Object.fromEntries(
            sheet.rows
              .filter((row) => !row.mark)
              .map((row) => [row.studentId, "Enter a mark before finalizing."]),
          ),
        );
      const result = {
        ...sheet,
        state: "FINAL" as const,
        version: version + 1,
        finalizedAt: new Date().toISOString(),
      };
      sheets.set(id, result);
      return {
        state: "FINAL",
        version: result.version,
        finalizedAt: result.finalizedAt,
        recordsCommitted: sheet.rows.length,
        notificationsQueued: 0,
      };
    },
    incompletes: async (signal) => {
      read(signal);
      return scenario === "empty" ? [] : structuredClone(incompletes);
    },
    complete: async (id, input) => {
      const item = incompletes.find((row) => row.id === id);
      if (!item) throw new ApiError(404, "RESOURCE_NOT_FOUND");
      if (item.completionPending) throw new ApiError(409, "VERSION_CONFLICT");
      if (!normalizeGrade(input.mark, true) || !input.form.size)
        throw new GradeValidationError({
          mark: "Enter a completion mark from 1.00 to 3.00 and attach the form.",
        });
      item.completionPending = true;
      return { id: "sample-completion", state: "PENDING_DEAN" };
    },
  };
}
