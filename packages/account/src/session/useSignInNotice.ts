import { NOTICES } from "@cbpupsis/shared/auth";
import { useRouterState, useSearch } from "@tanstack/react-router";

/**
 * Why sign-in is showing, for its notice: the API ended the session (in the API's own words
 * when it gave them), this client signed the person out for inactivity, or a reset finished.
 * Null when the person simply arrived.
 */
export function useSignInNotice(): string | null {
  const { expired, notice } = useSearch({ strict: false });
  const reason = useRouterState({ select: (state) => state.location.state.sessionEndedReason });
  if (expired === "idle") return NOTICES.timedOut;
  if (expired) return reason ?? NOTICES.sessionEnded;
  if (notice === "password-reset") return NOTICES.passwordReset;
  return null;
}
