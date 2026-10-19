import { AuthShell, useSignInNotice } from "@cbpupsis/account";
import { ApiError, errorMessage, isThrottled } from "@cbpupsis/shared/api";
import { ErrorAlert, Notice, RetryCountdown, useCountdown } from "@cbpupsis/ui";
import { Link } from "@tanstack/react-router";

import { useEnterPortal, useSignIn } from "./queries";
import { SignInForm } from "./SignInForm";

// Same layout as the faculty, admin, and superadmin sign-in pages.
export function SignInPage() {
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
  const status = useSignInNotice();

  return (
    <AuthShell busy={busy}>
      <header>
        <h1 id="auth-title" className="font-bold!">
          Hello, Iskolar.
        </h1>
        <p className="auth-subtitle text-brand-maroon! font-semibold! [text-shadow:0_1px_2px_rgb(255_255_255/0.55)]">
          Login and stay connected.
        </p>
      </header>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {remainingLock === 0 ? "The waiting period has ended. You can try signing in again." : ""}
      </div>
      {/* Notices and API errors are toasts; the form keeps only its own field validation. */}
      {status && !error && <Notice>{status}</Notice>}
      {error && !idError && (
        <ErrorAlert error={error}>
          {error instanceof ApiError && error.code === "AUTH_TEMPORARY_PASSWORD_EXPIRED" && (
            <p>
              <Link to="/forgot-password" className="inline-link">
                Reset your password
              </Link>
            </p>
          )}
          {lockError && <RetryCountdown remaining={remainingLock} />}
        </ErrorAlert>
      )}
      <SignInForm
        disabled={busy || locked}
        busy={busy}
        idError={idError}
        onSubmit={(credentials) => signIn.mutate(credentials, { onSuccess: () => enter.mutate() })}
      />
      <p className="account-help text-xs! font-normal! text-white/90! drop-shadow-sm">
        Don&apos;t have an account? Contact{" "}
        <a
          className="text-brand-maroon! font-semibold! [text-shadow:0_1px_3px_rgb(255_255_255/0.4)]"
          href="mailto:icto-admin@pup.edu.ph"
        >
          icto-admin@pup.edu.ph
        </a>
      </p>
    </AuthShell>
  );
}
