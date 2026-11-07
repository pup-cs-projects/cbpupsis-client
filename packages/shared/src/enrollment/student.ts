import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";

export type EnrollmentTermType = "REGULAR" | "SUMMER";

export interface EnrollmentHold {
  office: string;
  type: string;
  amount: number | null;
  isBlocking: boolean;
}

/** Why the student may not enroll, in the API's own words (one per unmet condition). */
export interface EligibilityReason {
  code: string;
  message: string;
}

export interface EnrollmentPeriod {
  /** ISO date or instant the enrollment period opens. */
  start: string;
  end: string;
  isOpen: boolean;
}

/**
 * GET /student/enrollment/eligibility (US-ENRL-001, issue #167): whether the student may
 * enroll, and their unit ceiling. Ineligibility (a hold, a closed period) is a state, never an
 * error: this call still answers 200, with `isEligible: false` and the reasons.
 */
export interface EnrollmentEligibility {
  isEligible: boolean;
  /** The current term's name, e.g. "2026-2027-First Semester". For display only. */
  term: string | null;
  /**
   * The current term's UUID, sent as `academicTermId` to every enrollment and certificate call
   * (API #221). Null from an API that does not send it yet.
   */
  academicTermId: string | null;
  termType: EnrollmentTermType;
  /** From the curriculum term template. Never a fixed number client-side. */
  prescribedLoad: number;
  approvedOverloadUnits: number;
  /** Units in overload requests waiting for the Dean; not in effectiveCeiling until approved. */
  pendingOverloadUnits: number;
  /** 0 for Good Standing/Warning Level 1, 3 for Warning Level 2, 6 for Probation. */
  standingReduction: number;
  /** prescribedLoad + approvedOverloadUnits - standingReduction. The one ceiling to show. */
  effectiveCeiling: number;
  academicStanding: string | null;
  overloadEligible: boolean;
  /** 2 for a transferee, shiftee, returnee, or back-subject student in summer; null otherwise. */
  summerSubjectCap: number | null;
  holds: EnrollmentHold[];
  academicPeriod: EnrollmentPeriod;
  reasons: EligibilityReason[];
}

export interface EnrollmentMeeting {
  /** Monday = 0 ... Sunday = 6. */
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
}

/** One row of GET /student/enrollment/available-courses (issue #168). */
export interface EnrollmentSection {
  sectionId: string;
  courseCode: string;
  title: string;
  units: number;
  schedule: EnrollmentMeeting[];
  facultyName: string | null;
  capacity: number;
  availableSlots: number;
  prerequisitesSatisfied: boolean;
  /** Why the student cannot pick this section, as plain text for display, or null. */
  blockReason: string | null;
  /** Ids of sections already selected or enrolled that overlap this one's schedule. */
  conflictsWith: string[];
}

export interface EnrolledSection {
  sectionId: string;
  courseCode: string;
  title: string;
  units: number;
}

/** The committed enrollment POST /student/enrollment/submit answers with (201, issue #169). */
export interface EnrollmentResult {
  enrollmentId: string;
  status: string;
  totalUnits: number;
  sections: EnrolledSection[];
}

export interface OverloadRequestResult {
  overloadRequestId: string;
  state: string;
}

/**
 * The signed-in student's enrollment: their unit ceiling, the sections open to them, and
 * submitting a pick (US-ENRL-001). The field names below are the API's own (issues #167-#170
 * write every request and response in camelCase, unlike the snake_case of older domains), so
 * this is the rare binding that reads the body almost as it arrives.
 *
 * Every call names the term by `academicTermId`, the UUID eligibility returns (API #221).
 */
export function createStudentEnrollmentApi(client: ApiClient) {
  return {
    async eligibility(accessToken: string): Promise<EnrollmentEligibility> {
      const body = await client.request("/student/enrollment/eligibility", {
        method: "GET",
        accessToken,
      });
      return parseEligibility(body);
    },

    /** The sections open to the student this term. An empty list, never a 404. */
    async availableCourses(
      accessToken: string,
      academicTermId: string,
    ): Promise<EnrollmentSection[]> {
      const query = new URLSearchParams({ academicTermId });
      const body = await client.request(`/student/enrollment/available-courses?${query}`, {
        method: "GET",
        accessToken,
      });
      return parse.array(body).map(parseSection);
    },

    async submit(
      accessToken: string,
      academicTermId: string,
      sectionIds: string[],
    ): Promise<EnrollmentResult> {
      const body = await client.request("/student/enrollment/submit", {
        method: "POST",
        accessToken,
        body: { academicTermId, sectionIds, confirmation: true },
      });
      return parseResult(body);
    },

    /** Files an overload request for up to 9 extra units (issue #170). Answers 202. */
    async requestOverload(
      accessToken: string,
      academicTermId: string,
      requestedUnits: number,
      justification: string,
    ): Promise<OverloadRequestResult> {
      const body = await client.request("/student/enrollment/overload", {
        method: "POST",
        accessToken,
        body: { academicTermId, requestedUnits, justification },
      });
      const r = parse.record(body);
      return {
        overloadRequestId: parse.string(r.overloadRequestId),
        state: parse.string(r.state),
      };
    },
  };
}

export type StudentEnrollmentApi = ReturnType<typeof createStudentEnrollmentApi>;

/** Pydantic sends decimals as strings ("3.0"); a number is accepted too. */
export function decimal(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : parse.invalid();
}

function parseHold(value: unknown): EnrollmentHold {
  const h = parse.record(value);
  return {
    office: parse.string(h.office),
    type: parse.string(h.type),
    amount: h.amount === null || h.amount === undefined ? null : decimal(h.amount),
    isBlocking: parse.boolean(h.isBlocking),
  };
}

function parsePeriod(value: unknown): EnrollmentPeriod {
  const p = parse.record(value);
  return {
    start: parse.string(p.start),
    end: parse.string(p.end),
    isOpen: parse.boolean(p.isOpen),
  };
}

function parseEligibility(value: unknown): EnrollmentEligibility {
  const e = parse.record(value);
  return {
    isEligible: parse.boolean(e.isEligible),
    term: parse.optionalString(e.term),
    academicTermId: parse.optionalString(e.academicTermId),
    termType: parse.oneOf(e.termType, ["REGULAR", "SUMMER"] as const),
    prescribedLoad: decimal(e.prescribedLoad),
    approvedOverloadUnits: decimal(e.approvedOverloadUnits),
    pendingOverloadUnits:
      e.pendingOverloadUnits === undefined ? 0 : decimal(e.pendingOverloadUnits),
    standingReduction: decimal(e.standingReduction),
    effectiveCeiling: decimal(e.effectiveCeiling),
    academicStanding: parse.optionalString(e.academicStanding),
    overloadEligible: parse.boolean(e.overloadEligible),
    summerSubjectCap:
      e.summerSubjectCap === null || e.summerSubjectCap === undefined
        ? null
        : parse.nonNegativeInteger(e.summerSubjectCap),
    holds: Array.isArray(e.holds) ? e.holds.map(parseHold) : [],
    academicPeriod: parsePeriod(e.academicPeriod),
    reasons: Array.isArray(e.reasons) ? e.reasons.map(parseReason) : [],
  };
}

function parseReason(value: unknown): EligibilityReason {
  const r = parse.record(value);
  return { code: parse.string(r.code), message: parse.string(r.message) };
}

/** One meeting of AvailableCourseRead.schedule, sent as `day`, `start`, `end`, `room`. */
function parseMeeting(value: unknown): EnrollmentMeeting {
  const m = parse.record(value);
  const day = parse.nonNegativeInteger(m.day);
  return {
    dayOfWeek: day <= 6 ? day : parse.invalid(),
    startTime: parse.string(m.start),
    endTime: parse.string(m.end),
    room: parse.optionalString(m.room),
  };
}

function parseSection(value: unknown): EnrollmentSection {
  const s = parse.record(value);
  return {
    sectionId: parse.string(s.sectionId),
    courseCode: parse.string(s.courseCode),
    title: parse.string(s.title),
    units: decimal(s.units),
    schedule: Array.isArray(s.schedule) ? s.schedule.map(parseMeeting) : [],
    facultyName: parse.optionalString(s.faculty),
    capacity: parse.nonNegativeInteger(s.capacity),
    availableSlots: parse.nonNegativeInteger(s.availableSlots),
    prerequisitesSatisfied:
      s.prerequisitesSatisfied === undefined ? true : parse.boolean(s.prerequisitesSatisfied),
    blockReason: parse.optionalString(s.blockReason),
    conflictsWith: Array.isArray(s.conflictsWith) ? s.conflictsWith.map(parse.string) : [],
  };
}

function parseEnrolledSection(value: unknown): EnrolledSection {
  const s = parse.record(value);
  return {
    sectionId: parse.string(s.sectionId),
    courseCode: parse.string(s.courseCode),
    title: parse.string(s.title),
    units: decimal(s.units),
  };
}

function parseResult(value: unknown): EnrollmentResult {
  const r = parse.record(value);
  return {
    enrollmentId: parse.string(r.enrollmentId),
    status: parse.string(r.status),
    totalUnits: decimal(r.totalUnits),
    sections: parse.array(r.sections).map(parseEnrolledSection),
  };
}
