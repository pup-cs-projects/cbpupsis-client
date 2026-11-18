import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";

/** Wire contracts from backend docs/openapi.json (API PR #221). No UI-only fields. */

/** One reason a section is blocked (AcademicBlock). `details` carries the third year counts. */
export interface AcademicBlock {
  rule: string;
  courseCode: string;
  blockingMark?: string | null;
  requiredRange?: string | null;
  details?: Record<string, unknown>;
}

/**
 * The blocking fields of one available-courses section (AvailableCourseRead). The page's own
 * section type has more fields; any value with these fits.
 */
export interface BlockedSection {
  sectionId: string;
  courseCode: string;
  prerequisitesSatisfied?: boolean;
  blockReason?: string | null;
  blocks?: AcademicBlock[];
  waiverAvailable?: boolean;
}

export type WaiverCondition = "REPEATED_PREREQUISITE" | "SUPERIOR_STANDING" | "GRADUATING";

export const WAIVER_STATES = [
  "PENDING_CHAIR",
  "PENDING_DEAN",
  "PENDING_VPAA",
  "APPROVED",
  "REJECTED",
] as const;

export type WaiverState = (typeof WAIVER_STATES)[number];

export interface WaiverFile {
  sectionId: string;
  prerequisiteCourseCode: string;
  condition: WaiverCondition;
  justification: string;
}

export interface WaiverFiled {
  waiverRequestId: string;
  state: WaiverState;
}

/** The student's own waiver (WaiverRead from GET /student/enrollment/waiver). */
export interface StudentWaiverRead {
  waiverRequestId: string;
  state: WaiverState;
  studentId: string;
  sectionId: string;
  prerequisiteCourseCode: string;
  condition: string;
  justification: string;
  reviewRemarks: string | null;
  vpaaReference: string | null;
  createdAt: string;
}

// Free text may legitimately be empty, which parse.string refuses.
function text(value: unknown): string {
  return typeof value === "string" ? value : parse.invalid();
}

function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

function parseFiled(value: unknown): WaiverFiled {
  const raw = parse.record(value);
  return {
    waiverRequestId: parse.string(raw.waiverRequestId),
    state: parse.oneOf(raw.state, WAIVER_STATES),
  };
}

function parseWaiver(value: unknown): StudentWaiverRead {
  const raw = parse.record(value);
  return {
    waiverRequestId: parse.string(raw.waiverRequestId),
    state: parse.oneOf(raw.state, WAIVER_STATES),
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

/** The student's co-requisite waiver endpoints (US-ENRL-002). */
export function createStudentWaiverApi(client: ApiClient) {
  return {
    async list(accessToken: string, signal?: AbortSignal): Promise<StudentWaiverRead[]> {
      const data = await client.request("/student/enrollment/waiver", {
        method: "GET",
        accessToken,
        signal,
      });
      return parse.array(data).map((item) => parseWaiver(item));
    },

    async file(accessToken: string, body: WaiverFile): Promise<WaiverFiled> {
      const data = await client.request("/student/enrollment/waiver", {
        method: "POST",
        accessToken,
        body,
      });
      return parseFiled(data);
    },
  };
}

export type StudentWaiverApi = ReturnType<typeof createStudentWaiverApi>;
