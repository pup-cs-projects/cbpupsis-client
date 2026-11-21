import { ApiError } from "./errors";

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Serialized as JSON, except `FormData`, which the browser sends as multipart. */
  body?: unknown;
  /** Sent as `Authorization: Bearer <token>`. */
  accessToken?: string;
  /** Cancels the call; it then rejects with the signal's reason, not an `ApiError`. */
  signal?: AbortSignal;
  /** Override the default 20-second deadline for documented long-running requests. */
  timeoutMs?: number;
}

export interface ApiClient {
  /**
   * Call the API and return the parsed JSON body (`undefined` for 204).
   *
   * The result is `unknown` on purpose: each caller narrows it with a parser at the boundary,
   * so a contract change fails there instead of deep inside a component.
   */
  request(path: string, options?: RequestOptions): Promise<unknown>;

  /** Call the API for a file (an image, an export) and return its bytes. */
  requestBlob(path: string, options?: RequestOptions): Promise<Blob>;
}

const TIMEOUT_MS = 20_000;

/**
 * Build the client for one API base URL (`VITE_API_BASE_URL`, e.g.
 * `http://localhost:8000/api/v1`). Paths are relative to it: `/auth/student/login`.
 */
export function createApiClient(baseUrl: string): ApiClient {
  const root = baseUrl.replace(/\/+$/, "");

  async function send(
    path: string,
    { method = "POST", body, accessToken, signal, timeoutMs = TIMEOUT_MS }: RequestOptions,
    accept: string,
  ): Promise<Response> {
    const isForm = body instanceof FormData;
    try {
      return await fetch(root + path, {
        method,
        headers: {
          Accept: accept,
          // A multipart body sets its own Content-Type, boundary included.
          ...(body === undefined || isForm ? {} : { "Content-Type": "application/json" }),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
        // The API also sets an HttpOnly refresh cookie; nothing reads it yet, and sending
        // credentials keeps that option open without a client change.
        credentials: "include",
        cache: "no-store",
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
          : AbortSignal.timeout(timeoutMs),
      });
    } catch {
      // A caller's cancellation is not a network failure; only a real one reaches the screen.
      if (signal?.aborted) throw signal.reason;
      throw new ApiError(0, "NETWORK_ERROR");
    }
  }

  async function failure(response: Response): Promise<ApiError> {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      return new ApiError(response.status, undefined);
    }
    return toApiError(response, data);
  }

  return {
    async request(path, options = {}) {
      const response = await send(path, options, "application/json");

      if (response.status === 204) return undefined;
      if (!response.ok) throw await failure(response);

      try {
        return (await response.json()) as unknown;
      } catch {
        throw new ApiError(response.status, "INVALID_RESPONSE");
      }
    },

    async requestBlob(path, options = {}) {
      const response = await send(path, { method: "GET", ...options }, "*/*");
      if (!response.ok) throw await failure(response);
      return response.blob();
    },
  };
}

function toApiError(response: Response, data: unknown): ApiError {
  const envelope = isRecord(data) ? data : {};
  const code = typeof envelope.code === "string" ? envelope.code : undefined;
  const requestId =
    typeof envelope.request_id === "string"
      ? envelope.request_id
      : (response.headers.get("X-Request-ID") ?? undefined);
  // A 423 carries the wait in its body; a 429 only in Retry-After, which the browser can read
  // only once the API lists it in CORS expose_headers.
  const retrySeconds =
    typeof envelope.retry_after_seconds === "number"
      ? envelope.retry_after_seconds
      : Number(response.headers.get("Retry-After") ?? Number.NaN);
  const retryAt =
    Number.isFinite(retrySeconds) && retrySeconds >= 0
      ? Date.now() + retrySeconds * 1000
      : undefined;
  const details = {
    ...(isRecord(envelope.details) ? envelope.details : {}),
    ...(Array.isArray(envelope.unmet_rules) ? { unmet_rules: envelope.unmet_rules } : {}),
    ...(code === "GRADE_MODE_MISMATCH" && typeof envelope.gradingMode === "string"
      ? { gradingMode: envelope.gradingMode }
      : {}),
    ...(code === "GRADE_MODE_MISMATCH" &&
    Array.isArray(envelope.allowedMarks) &&
    envelope.allowedMarks.every((mark) => typeof mark === "string")
      ? { allowedMarks: envelope.allowedMarks }
      : {}),
  };
  return new ApiError(response.status, code, {
    detail: detailOf(envelope),
    requestId,
    retryAt,
    details,
  });
}

/**
 * The API's sentence for a person: `detail` when it is prose, else `message` (both carry the
 * same text in today's envelope). FastAPI's 422 sends `detail` as a list of field errors, which
 * is not a sentence, so it yields nothing and the screen falls back to its own words.
 */
function detailOf(envelope: Record<string, unknown>): string | undefined {
  for (const value of [envelope.detail, envelope.message]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
