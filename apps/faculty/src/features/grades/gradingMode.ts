import type { FacultyGradeSheet as BaseGradeSheet } from "@cbpupsis/shared/grades";
import { normalizeGrade } from "@cbpupsis/shared/grades";

export type GradingMode = "NUMERIC" | "PASS_FAIL";
/** Metadata passed through by the final grading codec; no new API paths are needed. */
export interface FacultyGradeSheet extends BaseGradeSheet {
  gradingMode?: GradingMode;
  allowedMarks?: readonly string[];
}
export interface GradePolicy {
  mode: GradingMode | null;
  ready: boolean;
  allowedMarks: readonly string[];
  normalize: (value: string) => string | null;
  validationMessage: string;
}
function normalizeMark(value: string, mode: GradingMode): string | null {
  if (mode === "NUMERIC") return normalizeGrade(value);
  const mark = value.trim().toUpperCase();
  return mark === "PASS" || mark === "FAIL" ? mark : null;
}
export function gradePolicy(sheet: FacultyGradeSheet): GradePolicy {
  // Missing/partial metadata keeps editing disabled. The course name never determines mode.
  const mode =
    sheet.gradingMode === "NUMERIC" || sheet.gradingMode === "PASS_FAIL" ? sheet.gradingMode : null;
  const supplied = sheet.allowedMarks;
  const ready =
    mode !== null &&
    Array.isArray(supplied) &&
    supplied.length > 0 &&
    supplied.every((value) => typeof value === "string" && normalizeMark(value, mode) !== null);
  const allowedMarks = ready
    ? [...new Set(supplied!.map((value) => normalizeMark(value, mode!)!))]
    : [];
  return {
    mode,
    ready,
    allowedMarks,
    normalize: (value) => {
      if (!ready || !mode) return null;
      const mark = normalizeMark(value, mode);
      return mark && allowedMarks.includes(mark) ? mark : null;
    },
    validationMessage:
      mode === "PASS_FAIL"
        ? "Choose an allowed Pass or Fail mark."
        : "Enter one of the allowed numeric marks for this section.",
  };
}
export function gradeMarkLabel(mark: string): string {
  return mark === "PASS" ? "Pass" : mark === "FAIL" ? "Fail" : mark;
}
export function gradeDistribution(policy: GradePolicy, values: string[]) {
  const labels = policy.mode === "PASS_FAIL" ? ["PASS", "FAIL"] : ["1", "2", "3", "5", "INC"];
  return labels.map((label) => ({
    label:
      policy.mode === "PASS_FAIL"
        ? gradeMarkLabel(label)
        : label === "INC"
          ? "Incomplete"
          : label === "5" || label === "3"
            ? label + ".00"
            : label + ".00–" + label + ".75",
    count: values.filter((value) => {
      const mark = policy.normalize(value);
      return policy.mode === "PASS_FAIL" || label === "INC"
        ? mark === label
        : mark !== "INC" && mark?.startsWith(label);
    }).length,
  }));
}
