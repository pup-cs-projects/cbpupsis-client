import { AuthShell } from "@cbpupsis/account";
import { ApiError, errorMessage, isChallengeRejected, isThrottled } from "@cbpupsis/shared/api";
import { NOTICES } from "@cbpupsis/shared/auth";
import { AuthSkeleton, formatTime, QrCode, useCodeWindow, useCountdown } from "@cbpupsis/ui";
import { Link, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { session } from "../../lib/auth";
import { SignInForm } from "./SignInForm";
import { useAdminAuth, useEnterPortal } from "./useAdminAuth";

export function AdminLoginPage() {
  const { login, enrollment, confirmation, verification, keyEnrollment, securityKey } =
    useAdminAuth();
  const enter = useEnterPortal();
  const { expired: sessionExpired, notice } = useSearch({ strict: false });
  const [code, setCode] = useState("");
  const [enteredWindow, setEnteredWindow] = useState<number>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const challenge = login.data;
  const error =
    securityKey.error ||
    keyEnrollment.error ||
    verification.error ||
    confirmation.error ||
    enrollment.error ||
    login.error;
  const lockError = isThrottled(error) ? error : undefined;
  const remainingLock = useCountdown(lockError?.retryAt);
  const codeWindow = useCodeWindow(enrollment.data?.period ?? 30);
  const codeChanged =
    code.length > 0 && enteredWindow !== undefined && enteredWindow !== codeWindow.window;
  // The API refuses an expired or superseded challenge with a bare 401; only a new sign-in helps.
  const expired = Boolean(challenge) && isChallengeRejected(error);
  const locked = Boolean(lockError && (remainingLock === undefined || remainingLock > 0));
  const enrolling = challenge?.enrollmentRequired === true;
  const canUseKey =
    challenge?.methods.includes("webauthn") === true && challenge.webauthn.credentialId !== null;
  const busy =
    login.isPending ||
    enrollment.isPending ||
    confirmation.isPending ||
    verification.isPending ||
    keyEnrollment.isPending ||
    securityKey.isPending ||
    enter.isPending;
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
      : "Admin Portal";

  useEffect(() => {
    if (challenge) headingRef.current?.focus();
  }, [challenge, title]);

  function reset() {
    login.reset();
    enrollment.reset();
    confirmation.reset();
    verification.reset();
    keyEnrollment.reset();
    securityKey.reset();
    setCode("");
  }

  async function finish(step: Promise<unknown>) {
    try {
      await step;
      await enter.mutateAsync();
      // If the session ended while the account loaded, sign-in is showing again: clear the
      // finished steps so its notice is not hidden behind them.
      if (!session.isSignedIn()) reset();
    } catch {
      setCode("");
    }
  }

  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || locked || expired || busy || code.length !== 6) return;
    securityKey.reset();
    const step = { token: challenge.challengeToken, code };
    void finish(enrolling ? confirmation.mutateAsync(step) : verification.mutateAsync(step));
  }

  return (
    <AuthShell busy={busy} cardClassName={challenge ? "verification-card" : ""}>
      <header>
        <h1 id="auth-title" tabIndex={-1} ref={headingRef}>
          {title}
        </h1>
        <p className="auth-subtitle">
          {enrolling
            ? "Set up a second factor to continue."
            : challenge
              ? "One more step to your Admin Portal."
              : "Login and stay connected."}
        </p>
      </header>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {codeChanged ? "The previous code window has ended. Use the current code in your app." : ""}
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
                Add an authenticator app or register a security key. Administrative access always
                needs this second factor.
              </p>
              <button
                type="button"
                className="primary-button"
                disabled={busy || locked || expired}
                onClick={() => enrollment.mutate(challenge.challengeToken)}
              >
                {enrollment.isError ? "Retry authenticator setup" : "Set up authenticator"}
              </button>
              {challenge.methods.includes("webauthn") && (
                <button
                  type="button"
                  className="secondary-button security-key"
                  disabled={busy || locked || expired}
                  onClick={() => void finish(keyEnrollment.mutateAsync(challenge.challengeToken))}
                >
                  Register a security key
                </button>
              )}
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
          {((!enrolling && challenge.methods.includes("totp")) || enrollment.data) && (
            <form onSubmit={verify} className="code-form">
              <label htmlFor="auth-code">
                Authentication code <span className="required">*</span>
              </label>
              <p id="code-help">Enter the six digit code from your authenticator app.</p>
              <input
                id="auth-code"
                name="code"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                  setEnteredWindow(codeWindow.window);
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                required
                aria-describedby="code-help code-timing"
                disabled={busy || locked || expired}
              />
              <p id="code-timing" className="timing">
                Code refreshes in <span role="timer">{formatTime(codeWindow.remaining)}</span>.
                Follow the timer in your app.
                {codeChanged && " The previous code window has ended. Enter the current code."}
              </p>
              <button
                type="submit"
                className="primary-button"
                disabled={busy || locked || expired || code.length !== 6}
              >
                {enrolling ? "Verify authenticator" : "Verify and sign in"}
              </button>
            </form>
          )}
          {!enrolling && canUseKey && (
            <button
              type="button"
              className="secondary-button security-key"
              disabled={busy || locked || expired}
              onClick={() => {
                verification.reset();
                void finish(securityKey.mutateAsync(challenge));
              }}
            >
              Use a security key
            </button>
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
