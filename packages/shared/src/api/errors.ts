/**
 * The one error every API call rejects with.
 *
 * `detail` is the API's own sentence for a person, read from its error envelope
 * `{ status, message, detail, request_id, code? }`; it is what the screen shows. `code` is the
 * only thing to branch on: `detail` is prose the API may reword at any time. Failures that never
 * reached the API, or came back unreadable, get a client-side code and no `detail`.
 */
export class ApiError extends Error {
  /** HTTP status, or 0 when the request never got a response. */
  readonly status: number;
  readonly code: ApiErrorCode | undefined;
  /** The API's message for a person, when it sent one in words. */
  readonly detail: string | undefined;
  readonly requestId: string | undefined;
  /** Epoch milliseconds after which a 423 or 429 may be retried, when the API said. */
  readonly retryAt: number | undefined;
  /** The envelope's `details` object, for refusals that carry values (dates, unit limits). */
  readonly details: Record<string, unknown> | undefined;

  constructor(
    status: number,
    code: ApiErrorCode | undefined,
    options: {
      detail?: string;
      requestId?: string;
      retryAt?: number;
      details?: Record<string, unknown>;
    } = {},
  ) {
    super(options.detail ?? code ?? `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = options.detail;
    this.requestId = options.requestId;
    this.retryAt = options.retryAt;
    this.details = options.details;
  }
}

/**
 * Codes the client knows about. The API may add codes; an unknown one still arrives as a
 * string and falls through to the generic message.
 */
export type ApiErrorCode =
  // From the API (cbpupsis_shared/domains/auth/exceptions.py and the rate limiter).
  | "AUTH_FAILED"
  | "AUTH_ID_FORMAT_INVALID"
  | "AUTH_ACCOUNT_LOCKED"
  | "AUTH_MFA_INVALID"
  | "AUTH_MFA_CODE_REUSED"
  | "AUTH_MFA_REQUIRED"
  | "AUTH_MFA_ENROLLMENT_REQUIRED"
  | "AUTH_INSUFFICIENT_ROLE"
  | "AUTH_ADMIN_PROFILE_REQUIRED"
  | "AUTH_SESSION_EXPIRED"
  | "AUTH_TEMPORARY_PASSWORD_EXPIRED"
  | "PASSWORD_CHANGE_REQUIRED"
  | "SUPERADMIN_ROLE_REQUIRED"
  | "AUTH_PASSWORD_TOO_WEAK"
  | "AUTH_RESET_TOKEN_EXPIRED"
  | "AUTH_RESET_TOKEN_USED"
  | "INVALID_EMAIL_ADDRESS"
  | "RATE_LIMIT_EXCEEDED"
  | "rate_limited"
  // Client-side: the request failed before or after the API answered.
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE"
  | "NOT_SIGNED_IN"
  | "WEBAUTHN_UNAVAILABLE"
  | "WEBAUTHN_CANCELLED"
  // Client-side names for answers the API sends without a code (see auth/password.ts).
  | "RESET_LINK_INVALID"
  | "CURRENT_PASSWORD_INCORRECT"
  | (string & {});

/** True for the refusals that come with a waiting period: lockout and rate limiting. */
export function isThrottled(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 423 || error.status === 429);
}

/**
 * True when an MFA challenge token is no longer accepted: expired, superseded by a newer
 * sign-in, or already used. The API answers these with a bare 401 and no code, unlike a wrong
 * code (`AUTH_MFA_INVALID`), so the user must start sign-in again rather than retype.
 */
export function isChallengeRejected(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && error.code === undefined;
}

/** True when the account still holds a temporary password and must replace it first. */
export function isPasswordChangeRequired(error: unknown): error is ApiError {
  return (
    error instanceof ApiError && error.status === 403 && error.code === "PASSWORD_CHANGE_REQUIRED"
  );
}

/**
 * The only sentences the client writes for a failure: the ones where the API never answered,
 * or did not answer in words. Everything the API says, it says through `detail`.
 */
const CLIENT_MESSAGES: Partial<Record<string, string>> = {
  NETWORK_ERROR: "We could not reach the server. Check your connection, then try again.",
  INVALID_RESPONSE: "The server sent an answer we could not read. Try again in a moment.",
  NOT_SIGNED_IN: "Sign in to continue.",
  WEBAUTHN_UNAVAILABLE: "This browser cannot use security keys. Use your authenticator app.",
  WEBAUTHN_CANCELLED: "The security key check was cancelled or timed out. Try again.",
  // A reset address with no token in it: the page cannot ask the API about a link it lacks.
  RESET_LINK_INVALID:
    "This link is incomplete. Open the whole link from the email, or request a new one.",
};

const FALLBACK = "Something went wrong. Try again in a moment.";

/** The sentence to show a person for any error an API call rejected with: the API's own. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return FALLBACK;
  return error.detail ?? (error.code && CLIENT_MESSAGES[error.code]) ?? FALLBACK;
}
