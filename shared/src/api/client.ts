import { ApiError } from "./errors";

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Serialized as JSON. */
  body?: unknown;
  /** Sent as `Authorization: Bearer <token>`. */
  accessToken?: string;
}

export interface ApiClient {
  /**
   * Call the API and return the parsed JSON body (`undefined` for 204).
   *
   * The result is `unknown` on purpose: each caller narrows it with a parser at the boundary,
   * so a contract change fails there instead of deep inside a component.
   */
  request(path: string, options?: RequestOptions): Promise<unknown>;
}

const TIMEOUT_MS = 20_000;

/**
 * Build the client for one API base URL (`VITE_API_BASE_URL`, e.g.
 * `http://localhost:8000/api/v1`). Paths are relative to it: `/auth/student/login`.
 */
export function createApiClient(baseUrl: string): ApiClient {
  const root = baseUrl.replace(/\/+$/, "");

  return {
    async request(path, { method = "POST", body, accessToken } = {}) {
      let response: Response;
      try {
        response = await fetch(root + path, {
          method,
          headers: {
            Accept: "application/json",
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          // The API also sets an HttpOnly refresh cookie; nothing reads it yet, and sending
          // credentials keeps that option open without a client change.
          credentials: "include",
          cache: "no-store",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        throw new ApiError(0, "NETWORK_ERROR");
      }

      if (response.status === 204) return undefined;

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new ApiError(response.status, response.ok ? "INVALID_RESPONSE" : undefined);
      }

      if (!response.ok) throw toApiError(response, data);
      return data;
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
  return new ApiError(response.status, code, { requestId, retryAt });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
