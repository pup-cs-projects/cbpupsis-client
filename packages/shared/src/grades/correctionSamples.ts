import { ApiError } from "../api/errors";
import {
  canReviewCorrection,
  correctionMark,
  type Correction,
  type CorrectionSource,
  type CorrectionState,
} from "./corrections";
/** SAMPLE_GRADE_CORRECTIONS: opt-in local examples, with no browser persistence or real writes. */
export function createSampleCorrectionSource(
  portal: "faculty" | "admin",
  ownerId: string,
  role: string,
  scenario = "ready",
): CorrectionSource {
  let firstRead = true;
  const sections = [{ id: "sample-final", label: "COMP 021 · Software Engineering · BSCS 3-1" }];
  const students = ["Ana Santos", "Luis Reyes", "Carlo Cruz", "Maria Reyes"].map((name, index) => ({
    id: index === 0 ? "sample-student" : "sample-student-" + index,
    name,
    studentNumber: "2026-0000" + (index + 1) + "-DM-0",
    finalMark: "2.00",
  }));
  const states: CorrectionState[] = [
    "PENDING_CHAIR",
    "PENDING_DEAN",
    "PENDING_REGISTRAR",
    "REJECTED",
  ];
  const items: Correction[] = states.map((state, index) => ({
    id: "sample-correction-" + index,
    version: 1,
    sectionId: sections[0]!.id,
    sectionLabel: sections[0]!.label,
    studentId: students[index]!.id,
    studentName: students[index]!.name,
    studentNumber: students[index]!.studentNumber,
    oldMark: "2.00",
    proposedMark: "1.75",
    reason: "The signed grading sheet shows 1.75; the submitted record contains an entry error.",
    state,
    remarks:
      state === "REJECTED" ? "Attach a signed grading sheet before filing a new request." : null,
    filerId: portal === "faculty" ? ownerId : "sample-faculty",
    actedBy: [],
    sheetName: "sample-grading-sheet.pdf",
    sheetUrl: null,
  }));
  const allow = () => {
    if (portal === "admin" && !["chairperson", "dean", "registrar"].includes(role))
      throw new ApiError(403, "AUTH_INSUFFICIENT_ROLE");
  };
  const get = (id: string) => {
    allow();
    const item = items.find((item) => item.id === id);
    if (!item) throw new ApiError(404, "RESOURCE_NOT_FOUND");
    return item;
  };
  const read = (signal?: AbortSignal) => {
    allow();
    signal?.throwIfAborted();
    if (scenario === "error" && firstRead) {
      firstRead = false;
      throw new ApiError(503, "SAMPLE_SERVICE_UNAVAILABLE");
    }
  };
  return {
    list: async (signal) => {
      read(signal);
      return scenario === "empty" ? [] : structuredClone(items);
    },
    detail: async (id, signal) => {
      read(signal);
      return structuredClone(get(id));
    },
    sections: async (signal) => {
      read(signal);
      return scenario === "empty" ? [] : structuredClone(sections);
    },
    students: async (id, signal) => {
      read(signal);
      if (id !== sections[0]!.id) throw new ApiError(404, "RESOURCE_NOT_FOUND");
      return structuredClone(students);
    },
    file: async (input) => {
      if (portal !== "faculty") throw new ApiError(403, "AUTH_INSUFFICIENT_ROLE");
      if (scenario === "closed") throw new ApiError(403, "CORRECTION_WINDOW_CLOSED");
      const student = students.find((item) => item.id === input.studentId);
      const section = sections.find((item) => item.id === input.sectionId);
      if (!student || !section) throw new ApiError(404, "RESOURCE_NOT_FOUND");
      if (input.gradingSheet.size > 10 * 1024 * 1024) throw new ApiError(413, "FILE_TOO_LARGE");
      if (!["application/pdf", "image/jpeg", "image/png"].includes(input.gradingSheet.type))
        throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE");
      const mark = correctionMark(input.proposedMark);
      if (!mark || !input.reason.trim() || !input.gradingSheet.size)
        throw new ApiError(422, "VALIDATION_ERROR");
      const item: Correction = {
        id: crypto.randomUUID(),
        version: 1,
        sectionId: section.id,
        sectionLabel: section.label,
        studentId: student.id,
        studentName: student.name,
        studentNumber: student.studentNumber,
        oldMark: student.finalMark,
        proposedMark: mark,
        reason: input.reason.trim(),
        state: "PENDING_CHAIR",
        remarks: null,
        filerId: ownerId,
        actedBy: [],
        sheetName: input.gradingSheet.name,
        sheetUrl: null,
      };
      items.unshift(item);
      return structuredClone(item);
    },
    decide: async (id, input) => {
      const item = get(id);
      if (portal !== "admin") throw new ApiError(403, "AUTH_INSUFFICIENT_ROLE");
      if (item.filerId === ownerId || item.actedBy.includes(ownerId))
        throw new ApiError(403, "APPROVAL_SAME_ACTOR");
      if (item.version !== input.version) throw new ApiError(409, "VERSION_CONFLICT");
      if (
        !canReviewCorrection(role, ownerId, item) ||
        (input.action === "COMMIT" && role !== "registrar") ||
        (input.action === "ENDORSE" && role === "registrar")
      )
        throw new ApiError(409, "APPROVAL_OUT_OF_ORDER");
      if (input.action === "REJECT" && !input.remarks.trim())
        throw new ApiError(422, "DECISION_REMARKS_REQUIRED");
      item.state =
        input.action === "REJECT"
          ? "REJECTED"
          : input.action === "COMMIT"
            ? "COMMITTED"
            : role === "chairperson"
              ? "PENDING_DEAN"
              : "PENDING_REGISTRAR";
      item.version++;
      item.actedBy.push(ownerId);
      item.remarks = input.remarks.trim() || null;
      return structuredClone(item);
    },
  };
}
