import { ApiError, errorMessage } from "@cbpupsis/shared/api";
import type { AcademicBlock, WaiverState } from "@cbpupsis/shared/enrollment";

import { refusalMessage as enrollmentRefusal } from "./enrollmentDisplay";

/** "1.00-3.00" as the API sends it, read aloud as "1.00 to 3.00". */
function range(value: string | null | undefined): string {
  return (value ?? "1.00-3.00").replace("-", " to ");
}

function count(details: Record<string, unknown> | undefined, key: string): string {
  const value = details?.[key];
  return typeof value === "number" || typeof value === "string" ? String(value) : "0";
}

const THIRD_YEAR = "Finish PE 1 to 4 and 6 NSTP units before third year courses.";
const PE_SEQUENCE = "You can take one PE course per regular term.";
const WAIVER_PENDING = "Your waiver for this course is still being reviewed.";

function thirdYear(block: AcademicBlock | undefined): string {
  if (!block) return THIRD_YEAR;
  const pe = count(block.details, "peCompleted");
  const nstp = count(block.details, "nstpCompleted");
  return `${THIRD_YEAR} Done so far: ${pe} of 4 PE courses and ${nstp} of 6 NSTP units.`;
}

function prerequisite(block: AcademicBlock): string {
  return `Pass ${block.courseCode} with a mark from ${range(block.requiredRange)}. Your mark: ${block.blockingMark ?? "not taken"}.`;
}

/** What unlocks one block, in words; null for a rule this screen does not know. */
export function unlockText(block: AcademicBlock): string | null {
  switch (block.rule) {
    case "ENROLL_PREREQUISITE_NOT_MET":
      return prerequisite(block);
    case "ENROLL_WAIVER_PENDING":
      return `${prerequisite(block)} ${WAIVER_PENDING}`;
    case "ENROLL_THIRD_YEAR_GATE":
      return thirdYear(block);
    case "ENROLL_PE_SEQUENCE":
      return PE_SEQUENCE;
    default:
      return null;
  }
}

/**
 * The message for an enrollment refusal (409). `blocks` are the section's own, when the page
 * knows which section was refused, so the message can name the prerequisite and the counts.
 */
export function refusalMessage(error: unknown, blocks: AcademicBlock[] = []): string {
  const code: string | undefined = error instanceof ApiError ? error.code : undefined;
  const find = (rule: string) => blocks.find((block) => block.rule === rule);
  switch (code) {
    case "ENROLL_PREREQUISITE_NOT_MET": {
      const block = find(code);
      if (!block) return errorMessage(error);
      return `You have not passed the prerequisite ${block.courseCode}: your mark is ${block.blockingMark ?? "not taken"}. You need ${range(block.requiredRange)}.`;
    }
    case "ENROLL_THIRD_YEAR_GATE":
      return thirdYear(find(code));
    case "ENROLL_PE_SEQUENCE":
      return PE_SEQUENCE;
    case "ENROLL_WAIVER_PENDING":
      return WAIVER_PENDING;
    default:
      // The unit ceiling, schedule, hold, period and seat refusals (AC-ENRL-001).
      return enrollmentRefusal(error);
  }
}

export const WAIVER_STEP: Record<WaiverState, string> = {
  PENDING_CHAIR: "With the Chair",
  PENDING_DEAN: "With the Dean",
  PENDING_VPAA: "With the VPAA (recorded by the Registrar)",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};
