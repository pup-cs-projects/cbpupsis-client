import { AuthShell } from "@cbpupsis/account";
import { ApiError, errorMessage, isThrottled } from "@cbpupsis/shared/api";
import { NOTICES } from "@cbpupsis/shared/auth";
import { AuthSkeleton, formatTime, useCountdown } from "@cbpupsis/ui";
import { Link, useSearch } from "@tanstack/react-router";

import { useEnterPortal, useSignIn } from "./queries";
import { SignInForm } from "./SignInForm";

// Same layout as the faculty, admin, and superadmin sign-in pages.
export function SignInPage() {
  const { expired, notice } = useSearch({ strict: false });
  const signIn = useSignIn();
  const enter = useEnterPortal();

  const error = signIn.error;
  const busy = signIn.isPending || enter.isPending;
  const lockError = isThrottled(error) ? error : undefined;
  const remainingLock = useCountdown(lockError?.retryAt);
  const locked = Boolean(lockError && (remainingLock === undefined || remainingLock > 0));
  // A malformed student number is a field problem, not a sign-in failure (AC-101.2).
  const idError =
    error instanceof ApiError && error.code === "AUTH_ID_FORMAT_INVALID"
      ? errorMessage(error)
      : undefined;
  const status =
    expired === "idle"
      ? NOTICES.timedOut
      : expired
        ? NOTICES.sessionEnded
        : notice === "password-reset"
          ? NOTICES.passwordReset
          : null;

  return (
    <AuthShell busy={busy}>
      <header>
        <h1 id="auth-title">Student Portal</h1>
        <p className="auth-subtitle">Login and stay connected.</p>
      </header>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {remainingLock === 0 ? "The waiting period has ended. You can try signing in again." : ""}
      </div>
      {status && !error && (
        <p className="auth-notice" role="status">
          {status}
        </p>
      )}
      {error && !idError && (
        <div className="auth-error" role="alert">
          <p>{errorMessage(error)}</p>
          {error instanceof ApiError && error.code === "AUTH_TEMPORARY_PASSWORD_EXPIRED" && (
            <p>
              <Link to="/forgot-password" className="inline-link">
                Reset your password
              </Link>
            </p>
          )}
          {lockError && (
            <p>
              {remainingLock === undefined ? (
                "Contact the University Registrar if access is not restored."
              ) : remainingLock > 0 ? (
                <>
                  Try again in{" "}
                  <span role="timer" aria-label="Time before retry">
                    {formatTime(remainingLock)}
                  </span>
                  .
                </>
              ) : (
                "You can try again now."
              )}
            </p>
          )}
          {error instanceof ApiError && error.requestId && (
            <p className="request-id">Reference: {error.requestId}</p>
          )}
        </div>
      )}
      <SignInForm
        disabled={busy || locked}
        idError={idError}
        onSubmit={(credentials) => signIn.mutate(credentials, { onSuccess: () => enter.mutate() })}
      />
      {busy && <AuthSkeleton />}
      <p className="account-help">
        Trouble signing in? Contact the University Registrar or{" "}
        <a href="mailto:icto-admin@pup.edu.ph">icto-admin@pup.edu.ph</a>
      </p>
    </AuthShell>
  );
}
