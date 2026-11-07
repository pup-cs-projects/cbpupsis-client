import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";

export type EnrollmentTermType = "REGULAR" | "SUMMER";

export interface EnrollmentHold {
  office: string;
  type: string;
  amount: number | null;
  isBlocking: boolean;
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
  termType: EnrollmentTermType;
  /** From the curriculum term template. Never a fixed number client-side. */
  prescribedLoad: number;
  approvedOverloadUnits: number;
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
    async availableCourses(accessToken: string): Promise<EnrollmentSection[]> {
      const body = await client.request("/student/enrollment/available-courses", {
        method: "GET",
        accessToken,
      });
      return parse.array(body).map(parseSection);
    },

    async submit(accessToken: string, sectionIds: string[]): Promise<EnrollmentResult> {
      const body = await client.request("/student/enrollment/submit", {
        method: "POST",
        accessToken,
        body: { sectionIds, confirmation: true },
      });
      return parseResult(body);
    },

    /** Files an overload request for up to 9 extra units (issue #170). Answers 202. */
    async requestOverload(
      accessToken: string,
      requestedUnits: number,
      justification: string,
    ): Promise<OverloadRequestResult> {
      const body = await client.request("/student/enrollment/overload", {
        method: "POST",
        accessToken,
        body: { requestedUnits, justification },
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
function decimal(value: unknown): number {
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
    termType: parse.oneOf(e.termType, ["REGULAR", "SUMMER"] as const),
    prescribedLoad: decimal(e.prescribedLoad),
    approvedOverloadUnits: decimal(e.approvedOverloadUnits),
    standingReduction: decimal(e.standingReduction),
    effectiveCeiling: decimal(e.effectiveCeiling),
    academicStanding: parse.optionalString(e.academicStanding),
    overloadEligible: parse.boolean(e.overloadEligible),
    summerSubjectCap:
      e.summerSubjectCap === null || e.summerSubjectCap === undefined
        ? null
        : parse.nonNegativeInteger(e.summerSubjectCap),
    holds: parse.array(e.holds).map(parseHold),
    academicPeriod: parsePeriod(e.academicPeriod),
  };
}

function parseMeeting(value: unknown): EnrollmentMeeting {
  const m = parse.record(value);
  const day = parse.nonNegativeInteger(m.dayOfWeek);
  return {
    dayOfWeek: day <= 6 ? day : parse.invalid(),
    startTime: parse.string(m.startTime),
    endTime: parse.string(m.endTime),
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
    schedule: parse.array(s.schedule).map(parseMeeting),
    facultyName: parse.optionalString(s.facultyName),
    capacity: parse.nonNegativeInteger(s.capacity),
    availableSlots: parse.nonNegativeInteger(s.availableSlots),
    prerequisitesSatisfied: parse.boolean(s.prerequisitesSatisfied),
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
