import type { ApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import { parsePage } from "../sections/faculty";

/** Frontend models. The published backend codec is deliberately supplied separately. */
export interface GradingSection {
  id: string;
  courseCode: string;
  courseTitle: string;
  sectionName: string;
  termLabel: string;
  studentCount: number | null;
}
export interface FacultyGradeRow {
  studentId: string;
  studentNumber: string;
  studentName: string;
  mark: string | null;
  completionDeadline: string | null;
}
export interface FacultyGradeSheet {
  section: GradingSection;
  state: "DRAFT" | "FINAL";
  version: number;
  savedAt: string | null;
  finalizedAt: string | null;
  rows: FacultyGradeRow[];
  gradingMode?: "NUMERIC" | "PASS_FAIL";
  allowedMarks?: readonly string[];
}
export interface GradeDeadline {
  deadline: string | null;
  passed: boolean;
}
export interface GradeDraftInput {
  version: number;
  /** completionDeadline is an optional YYYY-MM-DD date chosen by the faculty for an INC mark. */
  grades: { studentId: string; mark: string | null; completionDeadline?: string | null }[];
}
export interface GradeFinalization {
  state: "FINAL";
  version: number;
  finalizedAt: string | null;
  recordsCommitted: number;
  notificationsQueued: number;
}
export interface FacultyIncomplete {
  id: string;
  studentName: string;
  studentNumber: string;
  section: GradingSection;
  completionDeadline: string | null;
  daysLeft: number | null;
  state: "PENDING_COMPLETION" | "COMPLETED" | "EXPIRED";
  completionPending: boolean;
}
export interface CompletionInput {
  mark: string;
  completionFormFileId: string;
}
export interface CompletionReceipt {
  id: string;
  state: "PENDING_DEAN";
}
export interface IncompleteCompletion {
  id: string;
  version: number;
  studentName: string;
  studentNumber: string;
  courseCode: string;
  sectionName: string;
  proposedMark: string;
  filedAt: string;
  state: "PENDING_DEAN" | "ENDORSED" | "REJECTED" | "EXPIRED";
  formName: string;
  formUrl: string | null;
  remarks: string | null;
}
export interface CompletionDecision {
  version: number;
  decision: "ENDORSE" | "REJECT";
  remarks: string;
}

/** A future codec maps the final OpenAPI wire fields to these stable UI models. */
export interface FacultyGradesContract {
  paginated?: boolean;
  normalizeError?(error: unknown): unknown;
  sections(body: unknown): GradingSection[];
  sheet(body: unknown): FacultyGradeSheet;
  deadline(body: unknown): GradeDeadline;
  finalized(body: unknown): GradeFinalization;
  incompletes(body: unknown): FacultyIncomplete[];
  completion(body: unknown): CompletionReceipt;
  draftBody(input: GradeDraftInput): unknown;
  finalizeBody(version: number): unknown;
  completionBody(input: CompletionInput): unknown;
}
export interface IncompleteReviewContract {
  paginated?: boolean;
  detailFromList?: boolean;
  normalizeError?(error: unknown): unknown;
  list(body: unknown): IncompleteCompletion[];
  detail(body: unknown): IncompleteCompletion;
  decisionBody(input: CompletionDecision): unknown;
}

function configured<T>(contract: T | undefined): T {
  if (!contract) throw new ApiError(503, "GRADING_NOT_CONFIGURED");
  return contract;
}
/** A codec can normalize published validation details without replaying the request. */
function gradingRequest(
  client: ApiClient,
  contract: { normalizeError?(error: unknown): unknown } | undefined,
): ApiClient["request"] {
  return async (route, options) => {
    const codec = configured(contract);
    try {
      return await client.request(route, options);
    } catch (error) {
      throw codec.normalizeError?.(error) ?? error;
    }
  };
}
const sectionPath = (id: string) => `/faculty/sections/${encodeURIComponent(id)}`;

/** List contracts use the shared Page envelope. Never silently truncate a faculty workload. */
async function readAll(
  request: ApiClient["request"],
  path: string,
  token: string,
  signal?: AbortSignal,
): Promise<unknown> {
  const items: unknown[] = [];
  let offset = 0;
  for (;;) {
    const page = parsePage(
      await request(`${path}?limit=200&offset=${offset}`, {
        method: "GET",
        accessToken: token,
        signal,
      }),
      (value) => value,
    );
    if (page.offset !== offset || (!page.items.length && offset < page.total))
      throw new ApiError(0, "INVALID_RESPONSE");
    items.push(...page.items);
    if (offset + page.items.length >= page.total) return { items };
    offset += page.items.length;
  }
}

/** No legacy route fallback, speculative payloads, or automatic write retries. */
export function createFacultyGradesApi(client: ApiClient, contract?: FacultyGradesContract) {
  const request = gradingRequest(client, contract);
  return {
    async sections(token: string, signal?: AbortSignal) {
      const codec = configured(contract);
      return codec.sections(
        codec.paginated
          ? await readAll(request, "/faculty/sections", token, signal)
          : await request("/faculty/sections", { method: "GET", accessToken: token, signal }),
      );
    },
    async sheet(token: string, id: string, signal?: AbortSignal) {
      const codec = configured(contract);
      return codec.sheet(
        await request(`${sectionPath(id)}/grades`, {
          method: "GET",
          accessToken: token,
          signal,
        }),
      );
    },
    async deadline(token: string, id: string, signal?: AbortSignal) {
      const codec = configured(contract);
      return codec.deadline(
        await request(`${sectionPath(id)}/grade-deadline`, {
          method: "GET",
          accessToken: token,
          signal,
        }),
      );
    },
    async saveDraft(token: string, id: string, input: GradeDraftInput) {
      const codec = configured(contract);
      const saved = codec.sheet(
        await request(`${sectionPath(id)}/grades/draft`, {
          method: "PUT",
          accessToken: token,
          body: codec.draftBody(input),
        }),
      );
      return { ...saved, savedAt: saved.savedAt ?? new Date().toISOString() };
    },
    async finalize(token: string, id: string, version: number) {
      const codec = configured(contract);
      return codec.finalized(
        await request(`${sectionPath(id)}/grades/finalize`, {
          method: "POST",
          accessToken: token,
          body: codec.finalizeBody(version),
        }),
      );
    },
    async incompletes(token: string, signal?: AbortSignal) {
      const codec = configured(contract);
      return codec.incompletes(
        codec.paginated
          ? await readAll(request, "/faculty/incompletes", token, signal)
          : await request("/faculty/incompletes", { method: "GET", accessToken: token, signal }),
      );
    },
    async complete(token: string, id: string, input: CompletionInput) {
      const codec = configured(contract);
      return codec.completion(
        await request(`/faculty/incompletes/${encodeURIComponent(id)}/completion`, {
          method: "POST",
          accessToken: token,
          body: codec.completionBody(input),
        }),
      );
    },
  };
}
export type FacultyGradesApi = ReturnType<typeof createFacultyGradesApi>;

export function createIncompleteReviewApi(client: ApiClient, contract?: IncompleteReviewContract) {
  const request = gradingRequest(client, contract);
  const root = "/admin/incomplete-completions";
  return {
    async list(token: string, signal?: AbortSignal) {
      const codec = configured(contract);
      return codec.list(
        codec.paginated
          ? await readAll(request, root, token, signal)
          : await request(root, { method: "GET", accessToken: token, signal }),
      );
    },
    async detail(token: string, id: string, signal?: AbortSignal) {
      const codec = configured(contract);
      if (codec.detailFromList) {
        const item = codec
          .list(await readAll(request, root, token, signal))
          .find((row) => row.id === id);
        if (!item) throw new ApiError(404, "RESOURCE_NOT_FOUND");
        return item;
      }
      return codec.detail(
        await request(`${root}/${encodeURIComponent(id)}`, {
          method: "GET",
          accessToken: token,
          signal,
        }),
      );
    },
    async decide(token: string, id: string, input: CompletionDecision) {
      const codec = configured(contract);
      return codec.detail(
        await request(`${root}/${encodeURIComponent(id)}`, {
          method: "PATCH",
          accessToken: token,
          body: codec.decisionBody(input),
        }),
      );
    },
  };
}
export type IncompleteReviewApi = ReturnType<typeof createIncompleteReviewApi>;

/** Codecs can normalize the API's student-specific validation details into field errors. */
export class GradeValidationError extends ApiError {
  readonly fields: Record<string, string>;
  constructor(fields: Record<string, string>) {
    super(422, "VALIDATION_ERROR");
    this.fields = fields;
  }
}

export function normalizeGrade(value: string, completion = false): string | null {
  const mark = value.trim().toUpperCase();
  if (!completion && mark === "INC") return "INC";
  if (!/^\d(?:\.\d{1,2})?$/.test(mark)) return null;
  const number = Number(mark);
  return (number >= 1 && number <= 3 && Number.isInteger(number * 4)) ||
    (!completion && number === 5)
    ? number.toFixed(2)
    : null;
}

export function gradingErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "GRADES_LOCKED":
        return "These grades are final. Use Correction of Entry to change one.";
      case "GRADE_DEADLINE_PASSED":
        return "The deadline has passed. Ask an administrator for an override.";
      case "VERSION_CONFLICT":
        return "These grades changed in another window. Reload to continue.";
      case "INC_COMPLETION_WINDOW_CLOSED":
        return "The completion period for this Inc has ended.";
      case "DECISION_REMARKS_REQUIRED":
        return "Enter remarks when rejecting a completion.";
      case "GRADING_NOT_CONFIGURED":
        return "Grade services are not available yet. Please try again later.";
      case "INC_UPLOAD_UNAVAILABLE":
        return "Completion filing is unavailable until completion-form uploads are enabled.";
      case "REQUEST_ALREADY_DECIDED":
        return "This request has already been decided. Refresh the record to continue.";
    }
    if (error.status === 401) return "Your session has ended. Sign in again to continue.";
    if (error.status === 403) return "This page is not available to your role.";
    if (error.status === 422) return "Check the highlighted fields and try again.";
  }
  return "The request could not be confirmed. Refresh the record before trying again.";
}
