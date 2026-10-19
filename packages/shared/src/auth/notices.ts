import { IDLE_TIMEOUT_MS } from "./idle";

/**
 * Sentences that tell a person what just happened after a redirect, shown with role="status".
 * They are client-written only because the API says nothing in words at these moments; errors
 * always show the API's own `detail` (api/errors.ts).
 */
export const NOTICES = {
  /**
   * The API ended the session (idled out server-side, or a refresh was refused) without saying
   * why in words, or the refresh never got an answer. When the API gives a reason, sign-in
   * shows that instead.
   */
  sessionEnded: "Your session has ended. Sign in again to continue.",
  /** This client signed the person out when the idle warning ran out. */
  timedOut: `You were signed out after ${IDLE_TIMEOUT_MS / 60_000} minutes of inactivity. Sign in again to continue.`,
  /** After a reset link was redeemed (AC-105.6). The API returns only `sessionsRevoked`. */
  passwordReset:
    "Your password has been changed, and every other session was signed out. Sign in with your new password.",
  /** After a temporary password was replaced. The API returns only the new token pair. */
  passwordChanged: "Your password has been changed. Use it the next time you sign in.",
} as const;
