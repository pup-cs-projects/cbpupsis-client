import * as p from "../api/parse";
import { parseSection } from "../sections/faculty";
import { correctionMark, type Correction, type CorrectionCodec } from "./corrections";

function date(value: unknown): string | null {
  const result = p.optionalString(value);
  return result === null || Number.isFinite(Date.parse(result)) ? result : p.invalid();
}
function mark(value: unknown): string {
  const result = p.string(value);
  return correctionMark(result) ? result : p.invalid();
}
function correction(value: unknown): Correction {
  const row = p.record(value);
  const version = p.nonNegativeInteger(row.version);
  if (version < 1) p.invalid();
  p.string(row.gradingSheetFileId);
  return {
    id: p.string(row.id),
    version,
    sectionId: p.string(row.sectionId),
    sectionLabel: null,
    studentId: p.string(row.studentId),
    studentName: null,
    studentNumber: null,
    oldMark: mark(row.currentMark),
    proposedMark: mark(row.proposedMark),
    reason: p.string(row.reason),
    state: p.oneOf(row.state, [
      "PENDING_CHAIR",
      "PENDING_DEAN",
      "PENDING_REGISTRAR",
      "COMMITTED",
      "REJECTED",
    ]),
    remarks: p.optionalString(row.rejectionRemarks),
    filerId: p.string(row.facultyId),
    actedBy: [row.chairApprovedBy, row.deanApprovedBy, row.registrarApprovedBy, row.rejectedBy]
      .filter((actor) => actor !== null && actor !== undefined)
      .map(p.string),
    sheetName: "Grading sheet attached",
    sheetUrl: null,
    sheetContentType: p.optionalString(row.gradingSheetContentType),
    sheetSize: row.gradingSheetSize == null ? null : p.nonNegativeInteger(row.gradingSheetSize),
    createdAt: date(row.createdAt),
    windowClosedAt: date(row.windowClosedAt),
  };
}
/** fr004 #272. Names, original filenames, and document URLs are not part of this contract. */
export const correctionCodec: CorrectionCodec = {
  paginated: true,
  list(body) {
    return p.array(p.record(body).items).map(correction);
  },
  detail: correction,
  sections(body) {
    return p.array(p.record(body).items).map((row) => {
      const section = parseSection(row);
      return { id: section.id, label: section.sectionName };
    });
  },
  finalStudents(body) {
    const sheet = p.record(body);
    if (p.oneOf(sheet.state, ["DRAFT", "FINAL"]) !== "FINAL") return [];
    return p
      .array(sheet.grades)
      .filter((value) => {
        const row = p.record(value);
        return row.status === "FINAL" && row.isLocked === true && row.isDraft === false;
      })
      .map((value) => {
        const row = p.record(value);
        return {
          id: p.string(row.studentId),
          name: p.string(row.studentName),
          studentNumber: p.string(row.studentNumber),
          finalMark: mark(row.finalGrade),
        };
      });
  },
  decision(input) {
    return {
      action: input.action,
      version: input.version,
      ...(input.remarks.trim() ? { remarks: input.remarks.trim() } : {}),
    };
  },
};
