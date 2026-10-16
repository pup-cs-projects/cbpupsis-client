import { ApiError, errorMessage, isChallengeRejected, isThrottled } from "@cbpupsis/shared/api";
import { NOTICES } from "@cbpupsis/shared/auth";
import { Link, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { session } from "../../lib/auth";
import { AuthShell } from "./AuthShell";
import { AuthSkeleton } from "./AuthSkeleton";
import { QrCode } from "./QrCode";
import { useEnterPortal, usePasswordStep, useSecondFactor, useTotpEnrollment } from "./queries";
import { SignInForm } from "./SignInForm";
import { formatTime, useCountdown } from "./useCountdown";

// Same layout as the admin sign-in page, without security keys: superadmins use TOTP only.
export function SignInPage() {
  const enter = useEnterPortal();
  const { expired: sessionExpired, notice } = useSearch({ strict: false });
  const login = usePasswordStep();
  const enrollment = useTotpEnrollment();
  const secondFactor = useSecondFactor();
  const [code, setCode] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const challenge = login.data;
  const error = secondFactor.error || enrollment.error || login.error;
  const lockError = isThrottled(error) ? error : undefined;
  const remainingLock = useCountdown(lockError?.retryAt);
  // The API refuses an expired or superseded challenge with a bare 401; only a new sign-in helps.
  const expired = Boolean(challenge) && isChallengeRejected(error);
  const locked = Boolean(lockError && (remainingLock === undefined || remainingLock > 0));
  const enrolling = challenge?.enrollmentRequired === true;
  const busy = login.isPending || enrollment.isPending || secondFactor.isPending || enter.isPending;
  const status =
    sessionExpired === "idle"
      ? NOTICES.timedOut
      : sessionExpired
        ? NOTICES.sessionEnded
        : notice === "password-reset"
          ? NOTICES.passwordReset
          : null;
  const title = enrolling
    ? "Secure your account"
    : challenge
      ? "Two-step verification"
      : "Superadmin Portal";

  useEffect(() => {
    if (challenge) headingRef.current?.focus();
  }, [challenge, title]);

  function reset() {
    login.reset();
    enrollment.reset();
    secondFactor.reset();
    setCode("");
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || locked || expired || busy || code.length !== 6) return;
    try {
      await secondFactor.mutateAsync({
        challengeToken: challenge.challengeToken,
        code,
        enrolling,
      });
      await enter.mutateAsync();
      // If the session ended while the account loaded, sign-in is showing again: clear the
      // finished steps so its notice is not hidden behind them.
      if (!session.isSignedIn()) reset();
    } catch {
      setCode("");
    }
  }

  return (
    <AuthShell busy={busy} cardClassName={challenge ? "verification-card" : ""}>
      <header>
        <h1 id="auth-title" tabIndex={-1} ref={headingRef}>
          {title}
        </h1>
        <p className="auth-subtitle">
          {enrolling
            ? "Set up your authenticator to continue."
            : challenge
              ? "One more step to your Superadmin Portal."
              : "Login and stay connected."}
        </p>
      </header>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {remainingLock === 0 ? "The waiting period has ended. You can try signing in again." : ""}
      </div>
      {status && !error && !challenge && (
        <p className="auth-notice" role="status">
          {status}
        </p>
      )}
      {error && (
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
                "Contact ICTO if access is not restored."
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
      {!challenge ? (
        <SignInForm
          disabled={busy || locked}
          onSubmit={(credentials) => login.mutate(credentials)}
        />
      ) : (
        <div className="second-factor">
          {enrolling && !enrollment.data && (
            <div className="setup-intro">
              <p>
                Add your superadmin account to an authenticator app. Every sign-in after this needs
                a code from it.
              </p>
              <button
                type="button"
                className="primary-button"
                disabled={busy || locked || expired}
                onClick={() => enrollment.mutate(challenge.challengeToken)}
              >
                {enrollment.isError ? "Retry authenticator setup" : "Set up authenticator"}
              </button>
            </div>
          )}
          {enrolling && enrollment.data && (
            <div className="enrollment-details">
              <p>Scan this code with your authenticator app, or enter the setup key.</p>
              <QrCode
                value={enrollment.data.uri}
                label={`QR code to add ${enrollment.data.accountName} to an authenticator app`}
              />
              <label htmlFor="setup-key">Setup key</label>
              <input
                id="setup-key"
                value={enrollment.data.secret}
                readOnly
                autoComplete="off"
                spellCheck={false}
              />
              <p>
                Account: {enrollment.data.accountName}
                {enrollment.data.issuer && (
                  <>
                    <br />
                    Issuer: {enrollment.data.issuer}
                  </>
                )}
              </p>
            </div>
          )}
          {(!enrolling || enrollment.data) && (
            <form onSubmit={verify} className="code-form">
              <label htmlFor="auth-code">
                Authentication code <span className="required">*</span>
              </label>
              <p id="code-help">Enter the six digit code from your authenticator app.</p>
              <input
                id="auth-code"
                name="code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                required
                aria-describedby="code-help"
                disabled={busy || locked || expired}
              />
              <button
                type="submit"
                className="primary-button"
                disabled={busy || locked || expired || code.length !== 6}
              >
                {enrolling ? "Verify authenticator" : "Verify and sign in"}
              </button>
            </form>
          )}
          <button type="button" className="back-button" onClick={reset} disabled={busy || locked}>
            Back to sign in
          </button>
        </div>
      )}
      {busy && <AuthSkeleton />}
      <p className="account-help">
        Don&apos;t have an account? Contact{" "}
        <a href="mailto:icto-admin@pup.edu.ph">icto-admin@pup.edu.ph</a>
      </p>
    </AuthShell>
  );
}
