import { ApiError } from "../api/errors";
import { isRecord } from "../api/client";
import * as p from "../api/parse";
import { parseSection } from "../sections/faculty";
import {
  GradeValidationError,
  normalizeGrade,
  type FacultyGradesContract,
  type IncompleteReviewContract,
  type IncompleteCompletion,
} from "./faculty";

/** Numeric marks accepted by fr004, including servers predating grading-mode metadata. */
export const NUMERIC_MARKS = [
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
] as const;
const items = (value: unknown) => p.array(p.record(value).items);
function normalizeError(error: unknown) {
  if (
    error instanceof ApiError &&
    error.code === "VALIDATION_ERROR" &&
    Array.isArray(error.details?.rows)
  ) {
    const fields: Record<string, string> = {};
    for (const raw of error.details.rows)
      if (isRecord(raw) && typeof raw.studentId === "string" && typeof raw.message === "string")
        fields[raw.studentId] = raw.message;
    if (Object.keys(fields).length) return new GradeValidationError(fields);
  }
  return error;
}
export const facultyGradesContract: FacultyGradesContract = {
  paginated: true,
  normalizeError,
  sections(body) {
    return items(body).map((raw) => {
      const row = parseSection(raw);
      return {
        id: row.id,
        sectionName: row.sectionName,
        courseCode: "",
        courseTitle: "",
        termLabel: "",
        studentCount: null,
      };
    });
  },
  sheet(value) {
    const row = p.record(value);
    const legacy = row.gradingMode === undefined && row.allowedMarks === undefined;
    const gradingMode = legacy ? "NUMERIC" : p.oneOf(row.gradingMode, ["NUMERIC", "PASS_FAIL"]);
    const allowedMarks = legacy ? [...NUMERIC_MARKS] : p.array(row.allowedMarks).map(p.string);
    if (
      !allowedMarks.length ||
      allowedMarks.some((mark) =>
        gradingMode === "PASS_FAIL"
          ? mark !== "PASS" && mark !== "FAIL"
          : normalizeGrade(mark) !== mark,
      )
    )
      p.invalid();
    const grades = p.array(row.grades).map((value) => {
      const grade = p.record(value);
      return {
        studentId: p.string(grade.studentId),
        studentNumber: p.string(grade.studentNumber),
        studentName: p.string(grade.studentName),
        mark: p.optionalString(grade.finalGrade),
        completionDeadline: p.optionalString(grade.completionDeadline ?? grade.incExpiresAt),
      };
    });
    return {
      section: {
        id: p.string(row.sectionId),
        sectionName: p.string(row.sectionName),
        courseCode: p.optionalString(row.courseCode) ?? "",
        courseTitle: p.optionalString(row.courseTitle) ?? "",
        termLabel: "",
        studentCount: grades.length,
      },
      state: p.oneOf(row.state, ["DRAFT", "FINAL"]),
      version: p.nonNegativeInteger(row.version),
      savedAt: null,
      finalizedAt: p.optionalString(row.submittedAt),
      rows: grades,
      gradingMode,
      allowedMarks,
    };
  },
  deadline(value) {
    const row = p.record(value);
    return { deadline: p.string(row.deadline), passed: p.boolean(row.passed) };
  },
  finalized(value) {
    const row = p.record(value);
    return {
      state: p.literal(row.state, "FINAL"),
      version: p.nonNegativeInteger(row.version),
      finalizedAt: p.string(row.submittedAt),
      recordsCommitted: p.nonNegativeInteger(row.recordsCommitted),
      notificationsQueued: p.nonNegativeInteger(row.notificationsQueued),
    };
  },
  draftBody(input) {
    return {
      version: input.version,
      grades: input.grades.map(({ studentId, mark }) => ({ studentId, finalGrade: mark })),
    };
  },
  finalizeBody(version) {
    return { version };
  },
  incompletes(value) {
    return items(value).map((value) => {
      const row = p.record(value);
      const latest = row.latestCompletion == null ? null : p.record(row.latestCompletion);
      const days = row.daysLeft;
      if (days !== null && (typeof days !== "number" || !Number.isInteger(days))) p.invalid();
      return {
        id: p.string(row.incId),
        studentName: p.string(row.studentName),
        studentNumber: p.string(row.studentNumber),
        section: {
          id: p.string(row.sectionId),
          sectionName: p.string(row.sectionName),
          courseCode: p.string(row.courseCode),
          courseTitle: p.string(row.courseTitle),
          termLabel: `${p.string(row.academicYear)} · ${p.string(row.semester)}`,
          studentCount: 0,
        },
        completionDeadline: p.optionalString(row.completionDeadline),
        daysLeft: days as number | null,
        state: p.oneOf(row.state, ["PENDING_COMPLETION", "COMPLETED", "EXPIRED"]),
        completionPending: latest?.state === "PENDING_DEAN",
      };
    });
  },
  completion(value) {
    const row = p.record(value);
    return { id: p.string(row.completionId), state: p.literal(row.state, "PENDING_DEAN") };
  },
  // fr004 accepts completionFormFileId as JSON, but does not expose a file upload.
  // Never send multipart, a filename, or a fabricated reference to that endpoint.
  completionBody() {
    throw new ApiError(503, "INC_UPLOAD_UNAVAILABLE");
  },
};
function completion(value: unknown): IncompleteCompletion {
  const row = p.record(value);
  return {
    id: p.string(row.completionId),
    version: p.nonNegativeInteger(row.version),
    studentName: p.string(row.studentName),
    studentNumber: p.string(row.studentNumber),
    courseCode: p.string(row.courseCode),
    sectionName: p.string(row.sectionName),
    proposedMark: p.string(row.proposedMark),
    filedAt: p.string(row.createdAt),
    state: p.oneOf(row.state, ["PENDING_DEAN", "ENDORSED", "REJECTED", "EXPIRED"]),
    formName: "Completion form attached; download unavailable",
    formUrl: null,
    remarks:
      typeof row.reviewRemarks === "string"
        ? row.reviewRemarks.trim() || null
        : p.optionalString(row.reviewRemarks),
  };
}
export const incompleteReviewContract: IncompleteReviewContract = {
  paginated: true,
  // fr004 exposes complete records in the list and PATCH; there is no GET /{id}.
  detailFromList: true,
  list(value) {
    return items(value).map(completion);
  },
  detail: completion,
  decisionBody(input) {
    return { version: input.version, decision: input.decision, remarks: input.remarks };
  },
};
