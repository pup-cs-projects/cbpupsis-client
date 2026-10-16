/**
 * The one error every API call rejects with.
 *
 * `code` comes from the API's error envelope `{ detail, request_id, code? }` and is the only
 * thing to branch on: `detail` is prose the API may reword at any time. Failures that never
 * reached the API, or came back unreadable, get a client-side code instead.
 */
export class ApiError extends Error {
  /** HTTP status, or 0 when the request never got a response. */
  readonly status: number;
  readonly code: ApiErrorCode | undefined;
  readonly requestId: string | undefined;
  /** Epoch milliseconds after which a 423 or 429 may be retried, when the API said. */
  readonly retryAt: number | undefined;

  constructor(
    status: number,
    code: ApiErrorCode | undefined,
    options: { requestId?: string; retryAt?: number; message?: string } = {},
  ) {
    super(options.message ?? code ?? `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = options.requestId;
    this.retryAt = options.retryAt;
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

const MESSAGES: Partial<Record<string, string>> = {
  AUTH_FAILED: "Those sign-in details do not match our records. Check them and try again.",
  AUTH_ID_FORMAT_INVALID:
    "Enter your ID in the format YYYY-NNNNN-XX-N, for example 2021-00123-MN-0.",
  AUTH_ACCOUNT_LOCKED: "Sign-in is temporarily locked after repeated failed attempts.",
  // The API sends this code only for password reset requests.
  RATE_LIMIT_EXCEEDED:
    "Too many reset requests. Wait before trying again, or use a link we already sent.",
  rate_limited: "Too many attempts. Please wait before trying again.",
  AUTH_MFA_INVALID: "That code is not valid. Enter the current code from your authenticator app.",
  AUTH_MFA_CODE_REUSED: "That code was already used. Wait for the next code in your app.",
  AUTH_MFA_REQUIRED: "Two-step verification is required. Sign in again to continue.",
  AUTH_MFA_ENROLLMENT_REQUIRED: "Set up two-step verification to continue.",
  AUTH_INSUFFICIENT_ROLE: "This account cannot sign in to this portal.",
  SUPERADMIN_ROLE_REQUIRED: "This account cannot sign in to this portal.",
  AUTH_ADMIN_PROFILE_REQUIRED:
    "Your administrator profile is not set up yet. Contact ICTO to finish setting it up.",
  AUTH_SESSION_EXPIRED: "Your session ended after a period of inactivity. Sign in again.",
  // A reset clears the temporary-password state, so it is a way forward that needs no one else.
  AUTH_TEMPORARY_PASSWORD_EXPIRED:
    "Your temporary password has expired. Reset your password to choose a new one, or ask ICTO to send a new temporary password.",
  PASSWORD_CHANGE_REQUIRED: "You must change your temporary password before continuing.",
  AUTH_PASSWORD_TOO_WEAK: "That password does not meet every rule in the list. Choose another one.",
  AUTH_RESET_TOKEN_EXPIRED: "That link has expired. Request a new one below.",
  AUTH_RESET_TOKEN_USED:
    "That link has already been used. If you just set a new password, sign in with it. Otherwise, request a new link below.",
  RESET_LINK_INVALID:
    "That link is not valid. Check that you opened the whole link from the email, or request a new one below.",
  INVALID_EMAIL_ADDRESS: "Enter a valid email address, such as name@pup.edu.ph.",
  CURRENT_PASSWORD_INCORRECT:
    "That temporary password is not correct. Copy it again from the email with your account details.",
  NETWORK_ERROR: "We could not reach the server. Check your connection and try again.",
  INVALID_RESPONSE: "Something went wrong on our side. Please try again.",
  NOT_SIGNED_IN: "Sign in to continue.",
  WEBAUTHN_UNAVAILABLE:
    "Security keys are not available in this browser. Use your authenticator app instead.",
  WEBAUTHN_CANCELLED: "Security key verification was cancelled or timed out. Try again.",
};

// A bare 401 means a challenge or session token was refused; both read the same to a person.
const CHALLENGE_REJECTED = "Your sign-in has expired. Sign in again to continue.";
const FALLBACK = "Something went wrong. Please try again.";

/** The sentence to show a person for any error an API call rejected with. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return FALLBACK;
  if (isChallengeRejected(error)) return CHALLENGE_REJECTED;
  return (error.code && MESSAGES[error.code]) || FALLBACK;
}
