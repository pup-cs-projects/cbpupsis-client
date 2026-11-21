import { ApiError, errorMessage } from "@cbpupsis/shared/api";
import type {
  EnrollmentEligibility,
  EnrollmentPeriod,
  EnrollmentTermType,
} from "@cbpupsis/shared/enrollment";

import { calendarDateInManila, formatEventDates, formatTimeRange } from "../../lib/datetime";
import { formatPeso } from "../../lib/money";

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

/** What a submitted enrollment's status means for the student. */
export function currentEnrollmentLabel(status: string): string {
  return status.toUpperCase() === "ENROLLED_PENDING"
    ? "Submitted, waiting to be made official"
    : "Officially enrolled";
}

/** Whole days from the period's start through its end, inclusive. */
export function periodDayCount(period: EnrollmentPeriod): number {
  const ms = new Date(period.end).getTime() - new Date(period.start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/** The header's Status cell: what the student can do right now. */
export function enrollmentStatusLabel(eligibility: EnrollmentEligibility): string {
  if (eligibility.currentEnrollment) return "Enrolled";
  if (!eligibility.academicPeriod.isOpen) return "Closed";
  if (!eligibility.isEligible) return "Not Eligible";
  return "Open";
}

/** Sentences for the refusals that need none of the API's own numbers (AC-ENRL-001.5, .11). */
const STATIC_REFUSAL: Partial<Record<string, string>> = {
  ENROLL_OVERLOAD_CAP_EXCEEDED: "An overload can add at most 9 units.",
  ENROLL_SECTION_FULL: "This section just filled up. Pick another section.",
  ENROLL_OVERLOAD_NOT_ELIGIBLE:
    "You can request an overload only if you have completed at least 85% of your curriculum units, or your last regular term GWA was 1.75 or below.",
};

/** A number from a refusal's `details`: the API sends decimals as strings, integers as numbers. */
function detailNumber(details: Record<string, unknown> | undefined, key: string): number | null {
  const value = details?.[key];
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function detailString(details: Record<string, unknown> | undefined, key: string): string | null {
  const value = details?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

/** "3 units", "1 unit". */
function units(n: number): string {
  return `${n} unit${n === 1 ? "" : "s"}`;
}

/** Each refusal's sentence, built from the numbers and names in its `details`. */
function refusalFromDetails(error: ApiError): string | null {
  const d = error.details;
  switch (error.code) {
    case "ENROLL_UNIT_CEILING_EXCEEDED": {
      const ceiling = detailNumber(d, "effectiveCeiling");
      const left = detailNumber(d, "unitsRemaining");
      return ceiling === null || left === null
        ? null
        : `This goes over your limit of ${units(ceiling)}. You have ${units(left)} left.`;
    }
    case "ENROLL_OVERLOAD_CAP_EXCEEDED": {
      const cap = detailNumber(d, "maximumOverloadUnits");
      return cap === null ? null : `An overload can add at most ${units(cap)}.`;
    }
    case "ENROLL_SUMMER_SUBJECT_LIMIT": {
      const cap = detailNumber(d, "summerSubjectCap");
      return cap === null
        ? null
        : `Summer allows at most ${cap} subject${cap === 1 ? "" : "s"} for you.`;
    }
    case "ENROLL_SCHEDULE_CONFLICT": {
      const codes = Array.isArray(d?.courseCodes) ? d.courseCodes : [];
      const overlap = d?.overlap;
      if (codes.length !== 2 || typeof overlap !== "object" || overlap === null) return null;
      const o = overlap as Record<string, unknown>;
      const day = typeof o.day === "number" ? WEEKDAY_NAMES[o.day] : undefined;
      if (!day || typeof o.start !== "string" || typeof o.end !== "string") return null;
      return `${String(codes[0])} and ${String(codes[1])} overlap on ${day}, ${formatTimeRange(o.start, o.end)}. Pick a different section for one of them.`;
    }
    case "ENROLL_FINANCIAL_HOLD": {
      const office = detailString(d, "office");
      const amount = detailNumber(d, "outstandingAmount");
      if (!office) return null;
      return `You have a financial hold${amount === null ? "" : ` of ${formatPeso(amount)}`} with the ${office}. Settle it there, then submit again.`;
    }
    case "ENROLL_HOLD_ACTIVE": {
      const office = detailString(d, "office");
      const type = detailString(d, "holdType");
      if (!office) return null;
      return `You have ${type ? `a ${type.toLowerCase()}` : "a"} hold with the ${office}. Clear it there, then submit again.`;
    }
    case "ENROLL_PERIOD_CLOSED": {
      const start = detailString(d, "start");
      const end = detailString(d, "end");
      return start && end
        ? `Enrollment is closed. The period runs ${periodDateRange({ start, end, isOpen: false })}.`
        : null;
    }
    default:
      return null;
  }
}

/** Full weekday names, Monday = 0, for sentences. */
const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/**
 * What a 409 refusal says to the student (AC-ENRL-001.2, .4, .5, .8, .9, .10, .11, .13, .14).
 * The sentence is built from the refusal's `details`; when those are missing, the API's own
 * sentence is shown, then a fixed one.
 */
export function refusalMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return errorMessage(error);
  return (
    refusalFromDetails(error) ??
    (error.code && STATIC_REFUSAL[error.code]) ??
    error.detail ??
    errorMessage(error)
  );
}

/** The sections a refusal names in its `details`, so its message can sit beside them. */
export function refusalSectionIds(error: unknown): string[] {
  if (!(error instanceof ApiError) || !error.details) return [];
  const { sectionId, sectionIds } = error.details;
  if (typeof sectionId === "string") return [sectionId];
  return Array.isArray(sectionIds) ? sectionIds.filter((id) => typeof id === "string") : [];
}

export function isEnrollmentErrorCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}
