import { IDLE_TIMEOUT_MS } from "./idle";

/**
 * Sentences that tell a person what just happened after a redirect. Errors live in
 * api/errors.ts; these are outcomes, shown with role="status".
 */
export const NOTICES = {
  /** The API ended the session: it idled out server-side, or a refresh was refused. */
  sessionEnded: "Your session ended after a period of inactivity. Sign in again.",
  /** This client signed the person out when the idle warning ran out. */
  timedOut: `You were signed out after ${IDLE_TIMEOUT_MS / 60_000} minutes of inactivity. Sign in again to continue.`,
  /** After a reset link was redeemed (AC-105.6). */
  passwordReset:
    "Your password has been changed, and every other session was signed out. Sign in with your new password.",
  /** After a temporary password was replaced. */
  passwordChanged: "Your password has been changed. Use it the next time you sign in.",
} as const;
