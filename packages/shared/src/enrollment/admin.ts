import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";

/** Wire contracts from backend docs/openapi.json. No UI-only fields.
 * Overload: fr003 918b439; add/drop: PR #211 bef214e; waivers: PR #213 b40a180.
 * Optional properties follow OpenAPI required/default semantics. Decimal units stay strings.
 * Waiver state/condition are strings in PR #213; the UI mapper validates supported values.
 */
export interface OverloadRequestRead {
  overloadRequestId: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  programCode: string;
  department: string;
  college: string | null;
  term: string;
  requestedUnits: number;
  justification: string;
  state: "PENDING_DEAN" | "APPROVED" | "REJECTED";
  reviewedBy?: string | null;
  remarks?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

export interface OverloadDecisionRequest {
  decision: "APPROVE" | "REJECT";
  remarks?: string | null;
}

export interface AddDropCourseRead {
  sectionId: string;
  courseCode: string;
  courseTitle: string;
  units: string;
  tag: "PENDING_ADD" | "PENDING_DROP";
  reason?: string | null;
}

export interface AdminAddDropRequestRead {
  requestId: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  programCode: string;
  department: string;
  college: string | null;
  term: string;
  academicTermId: string;
  state: "PENDING" | "APPROVED" | "REJECTED";
  unitsBefore: string;
  unitsAfter: string;
  comments?: string | null;
  remarks?: string | null;
  version?: number;
  courses?: Array<AddDropCourseRead>;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
}

export interface AddDropDecisionRequest {
  decision: "APPROVE" | "REJECT";
  remarks?: string | null;
  version: number;
}

export interface WaiverRead {
  waiverRequestId: string;
  state: string;
  studentId: string;
  sectionId: string;
  prerequisiteCourseCode: string;
  condition: string;
  justification: string;
  reviewRemarks: string | null;
  vpaaReference: string | null;
  createdAt: string;
}

export interface Page_WaiverRead_ {
  items: Array<WaiverRead>;
  total: number;
  limit: number;
  offset: number;
}

export interface WaiverDecision {
  decision: "APPROVE" | "REJECT";
  remarks?: string | null;
  vpaaReference?: string | null;
}

export type WaiverPage = Page_WaiverRead_;

// Free text may legitimately be empty, which parse.string refuses.
function text(value: unknown): string {
  return typeof value === "string" ? value : parse.invalid();
}

/** A field the API always sends, possibly null. */
function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

/** A field the API may leave out. */
function optionalText(value: unknown): string | null | undefined {
  return value === undefined ? undefined : nullableText(value);
}

const DECISION_STATES = ["APPROVED", "REJECTED"] as const;

function parseOverload(value: unknown): OverloadRequestRead {
  const raw = parse.record(value);
  return {
    overloadRequestId: parse.string(raw.overloadRequestId),
    studentId: parse.string(raw.studentId),
    studentNumber: text(raw.studentNumber),
    studentName: text(raw.studentName),
    programCode: text(raw.programCode),
    department: text(raw.department),
    college: nullableText(raw.college),
    term: text(raw.term),
    requestedUnits: parse.nonNegativeInteger(raw.requestedUnits),
    justification: text(raw.justification),
    state: parse.oneOf(raw.state, ["PENDING_DEAN", ...DECISION_STATES]),
    reviewedBy: optionalText(raw.reviewedBy),
    remarks: optionalText(raw.remarks),
    createdAt: parse.string(raw.createdAt),
    reviewedAt: optionalText(raw.reviewedAt),
  };
}

function parseAddDropCourse(value: unknown): AddDropCourseRead {
  const raw = parse.record(value);
  return {
    sectionId: parse.string(raw.sectionId),
    courseCode: text(raw.courseCode),
    courseTitle: text(raw.courseTitle),
    units: parse.string(raw.units),
    tag: parse.oneOf(raw.tag, ["PENDING_ADD", "PENDING_DROP"]),
    reason: optionalText(raw.reason),
  };
}

function parseAddDrop(value: unknown): AdminAddDropRequestRead {
  const raw = parse.record(value);
  return {
    requestId: parse.string(raw.requestId),
    studentId: parse.string(raw.studentId),
    studentNumber: text(raw.studentNumber),
    studentName: text(raw.studentName),
    programCode: text(raw.programCode),
    department: text(raw.department),
    college: nullableText(raw.college),
    term: text(raw.term),
    academicTermId: parse.string(raw.academicTermId),
    state: parse.oneOf(raw.state, ["PENDING", ...DECISION_STATES]),
    unitsBefore: parse.string(raw.unitsBefore),
    unitsAfter: parse.string(raw.unitsAfter),
    comments: optionalText(raw.comments),
    remarks: optionalText(raw.remarks),
    version: raw.version === undefined ? undefined : parse.nonNegativeInteger(raw.version),
    courses:
      raw.courses === undefined
        ? undefined
        : parse.array(raw.courses).map((course) => parseAddDropCourse(course)),
    createdAt: parse.string(raw.createdAt),
    reviewedAt: optionalText(raw.reviewedAt),
    reviewedBy: optionalText(raw.reviewedBy),
  };
}

function parseWaiver(value: unknown): WaiverRead {
  const raw = parse.record(value);
  return {
    waiverRequestId: parse.string(raw.waiverRequestId),
    state: parse.string(raw.state),
    studentId: parse.string(raw.studentId),
    sectionId: parse.string(raw.sectionId),
    prerequisiteCourseCode: text(raw.prerequisiteCourseCode),
    condition: parse.string(raw.condition),
    justification: text(raw.justification),
    reviewRemarks: nullableText(raw.reviewRemarks),
    vpaaReference: nullableText(raw.vpaaReference),
    createdAt: parse.string(raw.createdAt),
  };
}

function parseWaiverPage(value: unknown): WaiverPage {
  const raw = parse.record(value);
  return {
    items: parse.array(raw.items).map((item) => parseWaiver(item)),
    total: parse.nonNegativeInteger(raw.total),
    limit: parse.nonNegativeInteger(raw.limit),
    offset: parse.nonNegativeInteger(raw.offset),
  };
}

/** The reviewer endpoints behind the admin enrollment requests page. */
export function createAdminEnrollmentApi(client: ApiClient) {
  return {
    async listAddDrop(
      accessToken: string,
      signal?: AbortSignal,
    ): Promise<AdminAddDropRequestRead[]> {
      const data = await client.request("/admin/add-drop", { method: "GET", accessToken, signal });
      return parse.array(data).map((item) => parseAddDrop(item));
    },

    async decideAddDrop(
      accessToken: string,
      requestId: string,
      body: AddDropDecisionRequest,
    ): Promise<AdminAddDropRequestRead> {
      const path = `/admin/add-drop/${encodeURIComponent(requestId)}`;
      return parseAddDrop(await client.request(path, { method: "PATCH", accessToken, body }));
    },

    async listOverload(accessToken: string, signal?: AbortSignal): Promise<OverloadRequestRead[]> {
      const data = await client.request("/admin/overload-requests", {
        method: "GET",
        accessToken,
        signal,
      });
      return parse.array(data).map((item) => parseOverload(item));
    },

    async decideOverload(
      accessToken: string,
      overloadRequestId: string,
      body: OverloadDecisionRequest,
    ): Promise<OverloadRequestRead> {
      const path = `/admin/overload-requests/${encodeURIComponent(overloadRequestId)}`;
      return parseOverload(await client.request(path, { method: "PATCH", accessToken, body }));
    },

    async listWaivers(
      accessToken: string,
      { limit, offset }: { limit: number; offset: number },
      signal?: AbortSignal,
    ): Promise<WaiverPage> {
      const path = `/admin/waiver-requests?limit=${limit}&offset=${offset}`;
      return parseWaiverPage(await client.request(path, { method: "GET", accessToken, signal }));
    },

    async decideWaiver(
      accessToken: string,
      waiverRequestId: string,
      body: WaiverDecision,
    ): Promise<WaiverRead> {
      const path = `/admin/waiver-requests/${encodeURIComponent(waiverRequestId)}`;
      return parseWaiver(await client.request(path, { method: "PATCH", accessToken, body }));
    },
  };
}

export type AdminEnrollmentApi = ReturnType<typeof createAdminEnrollmentApi>;
