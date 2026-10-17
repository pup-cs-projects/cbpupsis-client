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
        <h1 id="auth-title" className="font-bold!">
          Hello, Iskolar.
        </h1>
        <p className="auth-subtitle font-semibold! text-[#9b1b1e]! [text-shadow:0_1px_2px_rgb(255_255_255/0.55)]">
          Login and stay connected.
        </p>
      </header>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {remainingLock === 0 ? "The waiting period has ended. You can try signing in again." : ""}
      </div>
      <SignInForm
        disabled={busy || locked}
        idError={idError}
        onSubmit={(credentials) => signIn.mutate(credentials, { onSuccess: () => enter.mutate() })}
        banner={
          <>
            {status && !error && (
              <p
                className="border-brand-gold bg-brand-cream text-brand-ink m-0 rounded-lg border-l-4 px-3 py-2 text-[13px] leading-snug"
                role="status"
              >
                {status}
              </p>
            )}
            {error && !idError && (
              <div
                className="border-brand-maroon bg-brand-error-surface text-brand-maroon-dark rounded-lg border-l-4 px-3 py-2 text-[13px] leading-snug"
                role="alert"
              >
                <p className="m-0 font-semibold">{errorMessage(error)}</p>
                <p className="m-0 [overflow-wrap:anywhere] empty:hidden">
                  {error instanceof ApiError &&
                    error.code === "AUTH_TEMPORARY_PASSWORD_EXPIRED" && (
                      <Link to="/forgot-password" className="mr-2 font-semibold underline">
                        Reset your password
                      </Link>
                    )}
                  {lockError && (
                    <span className="mr-2">
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
                    </span>
                  )}
                  {error instanceof ApiError && error.requestId && (
                    <span className="text-xs opacity-80">Reference: {error.requestId}</span>
                  )}
                </p>
              </div>
            )}
          </>
        }
      />
      {busy && <AuthSkeleton />}
      <p className="account-help text-xs! font-normal! text-white/90! drop-shadow-sm">
        Don&apos;t have an account? Contact{" "}
        <a
          className="font-semibold! text-[#a6192e]! [text-shadow:0_1px_3px_rgb(255_255_255/0.4)]"
          href="mailto:icto-admin@pup.edu.ph"
        >
          icto-admin@pup.edu.ph
        </a>
      </p>
    </AuthShell>
  );
}
