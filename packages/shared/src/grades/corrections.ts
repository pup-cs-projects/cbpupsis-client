import type { ApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import { normalizeGrade } from "./faculty";
import { parsePage } from "../sections/faculty";
import * as parse from "../api/parse";
export type CorrectionState =
  "PENDING_CHAIR" | "PENDING_DEAN" | "PENDING_REGISTRAR" | "COMMITTED" | "REJECTED";
export interface Correction {
  id: string;
  version: number;
  sectionId: string;
  sectionLabel: string | null;
  studentId: string;
  studentName: string | null;
  studentNumber: string | null;
  oldMark: string;
  proposedMark: string;
  reason: string;
  state: CorrectionState;
  remarks: string | null;
  filerId: string;
  actedBy: string[];
  sheetName: string;
  sheetUrl: string | null;
  sheetContentType?: string | null;
  sheetSize?: number | null;
  createdAt?: string | null;
  windowClosedAt?: string | null;
}
export interface CorrectionSection {
  id: string;
  label: string;
}
export interface CorrectionStudent {
  id: string;
  name: string;
  studentNumber: string;
  finalMark: string;
}
export interface CorrectionInput {
  sectionId: string;
  studentId: string;
  proposedMark: string;
  reason: string;
  gradingSheet: File;
}
export interface CorrectionDecision {
  action: "ENDORSE" | "COMMIT" | "REJECT";
  remarks: string;
  version: number;
}
/** Stable UI port; the published backend's response codec is supplied when available. */
export interface CorrectionCodec {
  paginated?: boolean;
  list(body: unknown): Correction[];
  detail(body: unknown): Correction;
  sections(body: unknown): CorrectionSection[];
  finalStudents(body: unknown): CorrectionStudent[];
  decision(input: CorrectionDecision): unknown;
  normalizeError?(error: unknown): unknown;
}
export interface CorrectionSource {
  list(signal?: AbortSignal): Promise<Correction[]>;
  detail(id: string, signal?: AbortSignal): Promise<Correction>;
  sections(signal?: AbortSignal): Promise<CorrectionSection[]>;
  students(section: string, signal?: AbortSignal): Promise<CorrectionStudent[]>;
  file(input: CorrectionInput): Promise<Correction>;
  decide(id: string, input: CorrectionDecision): Promise<Correction>;
}
export function createCorrectionApi(
  client: ApiClient,
  portal: "faculty" | "admin",
  codec?: CorrectionCodec,
) {
  const base = "/" + portal + "/grade-corrections";
  async function read<T>(
    route: string,
    token: string,
    parse: (body: unknown) => T,
    signal?: AbortSignal,
    method: "GET" | "POST" | "PATCH" = "GET",
    body?: unknown,
  ) {
    if (!codec) throw new ApiError(503, "CORRECTIONS_NOT_CONFIGURED");
    try {
      return parse(await client.request(route, { method, accessToken: token, signal, body }));
    } catch (error) {
      throw codec.normalizeError?.(error) ?? error;
    }
  }
  function configured() {
    if (!codec) throw new ApiError(503, "CORRECTIONS_NOT_CONFIGURED");
    return codec;
  }
  function facultyOnly() {
    if (portal !== "faculty") throw new ApiError(403, "AUTH_INSUFFICIENT_ROLE");
  }
  async function pages<T>(
    route: string,
    token: string,
    mapper: (body: unknown) => T,
    signal?: AbortSignal,
    limit = 100,
  ): Promise<T> {
    const items: unknown[] = [];
    let offset = 0;
    for (;;) {
      signal?.throwIfAborted();
      const page = await read(
        `${route}?limit=${limit}&offset=${offset}`,
        token,
        (body) => parsePage(body, (row) => row),
        signal,
      );
      if (page.offset !== offset || (!page.items.length && offset < page.total)) parse.invalid();
      items.push(...page.items);
      offset += page.items.length;
      if (offset >= page.total) return mapper({ items });
    }
  }
  return {
    list: async (token: string, signal?: AbortSignal) => {
      const codec = configured();
      return codec.paginated
        ? pages(base, token, codec.list, signal)
        : read(base, token, codec.list, signal);
    },
    detail: async (token: string, id: string, signal?: AbortSignal) =>
      read(base + "/" + encodeURIComponent(id), token, configured().detail, signal),
    sections: async (token: string, signal?: AbortSignal) => {
      facultyOnly();
      const codec = configured();
      return codec.paginated
        ? pages("/faculty/sections", token, codec.sections, signal, 200)
        : read("/faculty/sections", token, codec.sections, signal);
    },
    students: async (token: string, id: string, signal?: AbortSignal) => {
      facultyOnly();
      return read(
        "/faculty/sections/" + encodeURIComponent(id) + "/grades",
        token,
        configured().finalStudents,
        signal,
      );
    },
    file: async (token: string, input: CorrectionInput) => {
      facultyOnly();
      const c = configured();
      const body = new FormData();
      body.set("student_id", input.studentId);
      body.set("proposed_mark", input.proposedMark);
      body.set("reason", input.reason);
      body.set("grading_sheet", input.gradingSheet);
      return read(
        "/faculty/sections/" + encodeURIComponent(input.sectionId) + "/grade-corrections",
        token,
        c.detail,
        undefined,
        "POST",
        body,
      );
    },
    decide: async (token: string, id: string, input: CorrectionDecision) => {
      if (portal !== "admin") throw new ApiError(403, "AUTH_INSUFFICIENT_ROLE");
      return read(
        base + "/" + encodeURIComponent(id),
        token,
        configured().detail,
        undefined,
        "PATCH",
        configured().decision(input),
      );
    },
  };
}
export const correctionLabels: Record<CorrectionState, string> = {
  PENDING_CHAIR: "Pending: Chair",
  PENDING_DEAN: "Pending: Dean",
  PENDING_REGISTRAR: "Pending: Registrar",
  COMMITTED: "Committed",
  REJECTED: "Rejected",
};
export function correctionMark(value: string) {
  return normalizeGrade(value);
}
export function canReviewCorrection(role: string, owner: string, item: Correction) {
  return (
    item.filerId !== owner &&
    !item.actedBy.includes(owner) &&
    (
      {
        chairperson: "PENDING_CHAIR",
        dean: "PENDING_DEAN",
        registrar: "PENDING_REGISTRAR",
      } as Record<string, string>
    )[role] === item.state
  );
}
export function correctionMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "CORRECTION_WINDOW_CLOSED":
        return "The correction window for these grades has closed.";
      case "APPROVAL_SAME_ACTOR":
        return "You already acted on this correction.";
      case "APPROVAL_OUT_OF_ORDER":
        return "This correction is not at your step.";
      case "DECISION_REMARKS_REQUIRED":
        return "Remarks are required when rejecting a correction.";
      case "FILE_TOO_LARGE":
        return "The grading sheet must be at most 10 MB.";
      case "UNSUPPORTED_MEDIA_TYPE":
        return "Upload a PDF, JPEG, or PNG grading sheet.";
      case "VERSION_CONFLICT":
        return "This correction changed. Reload it before acting again.";
      case "CORRECTIONS_NOT_CONFIGURED":
        return "Correction services are not available yet. Please try again later.";
      case "GRADE_RECORD_UNAVAILABLE":
        return "The academic record is temporarily unavailable. Please try again later.";
    }
    if (error.status === 404) return "This correction is not available.";
    if (error.status === 403) return "This page is not available to your role.";
    if (error.status === 413) return "The grading sheet must be at most 10 MB.";
    if (error.status === 415) return "Upload a PDF, JPEG, or PNG grading sheet.";
    if (error.status === 401) return "Your session has ended. Sign in again.";
    if (error.status === 422) return error.detail ?? "Check the correction fields and try again.";
  }
  return "The request could not be confirmed. Refresh before trying again.";
}
