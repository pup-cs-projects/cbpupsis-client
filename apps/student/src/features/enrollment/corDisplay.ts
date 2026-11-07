import type { Assessment, Certificate } from "@cbpupsis/shared/enrollment";

import { formatPeso } from "../../lib/money";

// Shared by the full-page Certificate of Registration view and the in-place print template, so
// the two documents never drift apart.

const SEMESTER_LABEL: Record<string, string> = {
  first: "First Semester",
  second: "Second Semester",
  summer: "Summer Term",
};

export function semesterLabel(semester: string): string {
  return SEMESTER_LABEL[semester] ?? semester;
}

/** "Bachelor of Science in Computer Science" -> "BSCS". Skips short joining words, so it lands
 * on the same code the registrar uses for every program in the catalog (BSCS, BSIT, ...). */
export function programCode(programName: string): string {
  const skip = new Set(["of", "in", "and", "the", "for"]);
  const initials = programName
    .split(/\s+/)
    .filter((word) => word && !skip.has(word.toLowerCase()))
    .map((word) => word[0]?.toUpperCase())
    .join("");
  return initials || programName;
}

export function assessmentLabel(assessment: Assessment): string {
  return assessment.netPayable <= 0 && (assessment.fheQualified || assessment.lines.length === 0)
    ? "FREE"
    : formatPeso(assessment.netPayable);
}

/** No campus or year-level field exists anywhere in the data model yet; every printed COR shows
 * the same values until one does. */
export const CAMPUS = "Manila";
export const YEAR_LEVEL = "Fourth Year";

export function sectionLabel(certificate: Pick<Certificate, "courses">): string {
  return certificate.courses[0]?.section ?? "5";
}

// No stored address or phone yet (a brand-new profile): a readable sample rather than a blank
// cell, until the student fills in their profile.
export const FALLBACK_ADDRESS =
  "4FK BLK 1-D PH 1, CARENVILLE SUBD., AQUAMARINE ST., BRGY. MAGDALO, RD. POTOL, KAWIT, CAVITE";
export const FALLBACK_CONTACT = "09770561762";
