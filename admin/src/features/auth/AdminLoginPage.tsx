import { ApiError, errorMessage, isChallengeRejected, isThrottled } from "@cbpupsis/shared/api";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import logo from "../../assets/pup-logo.png";
import { AuthSkeleton } from "./AuthSkeleton";
import { QrCode } from "./QrCode";
import { SignInForm } from "./SignInForm";
import { useAdminAuth } from "./useAdminAuth";
import { formatTime, useCountdown, useCodeWindow } from "./useCountdown";
import "./auth.css";

export function AdminLoginPage() {
  const { login, enrollment, confirmation, verification, keyEnrollment, securityKey } =
    useAdminAuth();
  const navigate = useNavigate();
  const { expired: sessionExpired } = useSearch({ strict: false });
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
    securityKey.isPending;
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
      reset();
      await navigate({ to: "/dashboard", replace: true });
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
    <div className="admin-page">
      <a className="skip-link" href="#sign-in">
        Skip to sign in
      </a>
      <main className="login-scene">
        <div className="scene-inner">
          <div className="portal-brand">
            <img
              src={logo}
              alt="Polytechnic University of the Philippines seal"
              width="64"
              height="64"
            />
            <div>
              <p className="brand-name">CBPUPSIS</p>
              <p className="brand-subtitle">PUP Academic Portal</p>
            </div>
          </div>
          <div className="campaign" aria-label="Reforging excellence. Sinta, now in the cloud.">
            <span className="campaign-eyebrow">REFORGING EXCELLENCE</span>
            <p>
              SINTA
              <br />
              NOW IN
              <br />
              <span>THE CLOUD</span>
            </p>
          </div>
          <section
            id="sign-in"
            className={`login-card ${challenge ? "verification-card" : ""}`}
            aria-labelledby="auth-title"
            aria-busy={busy}
          >
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
              {codeChanged
                ? "The previous code window has ended. Use the current code in your app."
                : ""}
              {remainingLock === 0
                ? "The waiting period has ended. You can try signing in again."
                : ""}
            </div>
            {sessionExpired && !error && !challenge && (
              <p className="auth-notice" role="status">
                Your session ended after a period of inactivity. Sign in again.
              </p>
            )}
            {error && (
              <div className="auth-error" role="alert">
                <p>{errorMessage(error)}</p>
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
                      Add an authenticator app or register a security key. Administrative access
                      always needs this second factor.
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
                        onClick={() =>
                          void finish(keyEnrollment.mutateAsync(challenge.challengeToken))
                        }
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
                      Code refreshes in <span role="timer">{formatTime(codeWindow.remaining)}</span>
                      . Follow the timer in your app.
                      {codeChanged &&
                        " The previous code window has ended. Enter the current code."}
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
                <button
                  type="button"
                  className="back-button"
                  onClick={reset}
                  disabled={busy || locked}
                >
                  Back to sign in
                </button>
              </div>
            )}
            {busy && <AuthSkeleton />}
            <p className="account-help">
              Don&apos;t have an account? Contact{" "}
              <a href="mailto:icto-admin@pup.edu.ph">icto-admin@pup.edu.ph</a>
            </p>
          </section>
        </div>
      </main>
      <footer className="portal-footer">
        <p>© 2026 Polytechnic University of the Philippines</p>
        <nav aria-label="University information">
          <a href="https://www.pup.edu.ph/privacy/">Privacy Policy</a>
          <a href="https://www.pup.edu.ph/terms/">Terms of Service</a>
          <a href="https://www.pup.edu.ph/students/registrar">University Registrar</a>
        </nav>
      </footer>
    </div>
  );
}
