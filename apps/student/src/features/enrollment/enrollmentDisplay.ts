import { ApiError, errorMessage } from "@cbpupsis/shared/api";
import type {
  EnrollmentEligibility,
  EnrollmentPeriod,
  EnrollmentTermType,
} from "@cbpupsis/shared/enrollment";

import { calendarDateInManila, formatEventDates } from "../../lib/datetime";

/** Monday = 0 ... Sunday = 6, matching the API's dayOfWeek. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const TERM_TYPE_LABEL: Record<EnrollmentTermType, string> = {
  REGULAR: "Regular Term",
  SUMMER: "Summer Term",
};

export function termTypeLabel(termType: EnrollmentTermType): string {
  return TERM_TYPE_LABEL[termType];
}

/** The period's start and end, in Manila, as one readable range. */
export function periodDateRange(period: EnrollmentPeriod): string {
  return formatEventDates(calendarDateInManila(period.start), calendarDateInManila(period.end));
}

/** Just the day the period opens, in Manila: when "Enrollment Date" means "starts on". */
export function periodStartDate(period: EnrollmentPeriod): string {
  return formatEventDates(calendarDateInManila(period.start));
}

/** Whole days from the period's start through its end, inclusive. */
export function periodDayCount(period: EnrollmentPeriod): number {
  const ms = new Date(period.end).getTime() - new Date(period.start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/** The header's Status cell: what the student can do right now. */
export function enrollmentStatusLabel(eligibility: EnrollmentEligibility): string {
  if (eligibility.isEnrolled || eligibility.enrollmentStatus?.toUpperCase() === "ENROLLED") {
    return "Enrolled";
  }
  if (!eligibility.academicPeriod.isOpen) return "Closed";
  if (!eligibility.isEligible) return "Not Eligible";
  return "Open";
}

/** Sentences for the refusals that need none of the API's own words (AC-ENRL-001.4, .5). */
const STATIC_REFUSAL: Partial<Record<string, string>> = {
  ENROLL_OVERLOAD_CAP_EXCEEDED: "An overload can add at most 9 units.",
  ENROLL_SECTION_FULL: "This section just filled up. Pick another section.",
  ENROLL_OVERLOAD_NOT_ELIGIBLE:
    "You can request an overload only if you have completed at least 85% of your curriculum units, or your last regular term GWA was 1.75 or below.",
};

/**
 * What a 409 refusal says to the student. The API computes the sentence for the refusals that
 * carry a number (AC-ENRL-001.2 names the limit and units remaining, .9 names both courses and
 * the overlap), so `detail` is shown first; the rest fall back to a fixed sentence.
 */
export function refusalMessage(error: unknown, summerSubjectCap?: number | null): string {
  if (!(error instanceof ApiError)) return errorMessage(error);
  if (error.detail) return error.detail;
  if (error.code === "ENROLL_SUMMER_SUBJECT_LIMIT") {
    return `Summer allows at most ${summerSubjectCap ?? 2} subjects for you.`;
  }
  return (error.code && STATIC_REFUSAL[error.code]) || errorMessage(error);
}

export function isEnrollmentErrorCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}
