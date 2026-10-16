import { ApiError, errorMessage, isChallengeRejected, isThrottled } from "@cbpupsis/shared/api";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import logo from "../../assets/pup-logo.png";
import { AuthSkeleton } from "./AuthSkeleton";
import { QrCode } from "./QrCode";
import { SignInForm } from "./SignInForm";
import { useFacultyAuth } from "./useFacultyAuth";
import { formatTime, useCountdown, useCodeWindow } from "./useCountdown";
import "./auth.css";

export function FacultyLoginPage() {
  const { login, enrollment, confirmation, verification } = useFacultyAuth();
  const navigate = useNavigate();
  const { expired: sessionExpired } = useSearch({ strict: false });
  const [copyStatus, setCopyStatus] = useState("");
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [enteredWindow, setEnteredWindow] = useState<number>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const challenge = login.data;
  const recoveryCodes = confirmation.data?.recoveryCodes;
  const error = verification.error || confirmation.error || enrollment.error || login.error;
  const lockError = isThrottled(error) ? error : undefined;
  const remainingLock = useCountdown(lockError?.retryAt);
  const codeWindow = useCodeWindow(enrollment.data?.period ?? 30);
  const codeChanged =
    code.length > 0 && enteredWindow !== undefined && enteredWindow !== codeWindow.window;
  // The API refuses an expired or superseded challenge with a bare 401; only a new sign-in helps.
  const expired = Boolean(challenge) && isChallengeRejected(error);
  const idError =
    error instanceof ApiError && error.code === "AUTH_ID_FORMAT_INVALID"
      ? errorMessage(error)
      : undefined;
  const locked = Boolean(lockError && (remainingLock === undefined || remainingLock > 0));
  const enrolling = challenge?.enrollmentRequired === true;
  const busy =
    login.isPending || enrollment.isPending || confirmation.isPending || verification.isPending;
  const codeLength = useRecovery ? code.trim().length > 0 : code.length === 6;
  const title = recoveryCodes
    ? "Save your recovery codes"
    : enrolling
      ? "Secure your account"
      : challenge
        ? "Two-step verification"
        : "Faculty Portal";

  useEffect(() => {
    if (challenge) headingRef.current?.focus();
  }, [challenge, title]);

  function reset() {
    login.reset();
    enrollment.reset();
    confirmation.reset();
    verification.reset();
    setCode("");
    setUseRecovery(false);
    setCopyStatus("");
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || locked || expired || busy || !codeLength) return;
    try {
      if (enrolling) {
        // Confirming starts the session and returns recovery codes, shown once (AC-102.2).
        await confirmation.mutateAsync({ token: challenge.challengeToken, code });
        setCode("");
        return;
      }
      await verification.mutateAsync({
        token: challenge.challengeToken,
        factor: useRecovery ? { recoveryCode: code.trim() } : { code },
      });
      reset();
      await navigate({ to: "/dashboard", replace: true });
    } catch {
      setCode("");
    }
  }

  async function copyCodes() {
    if (!recoveryCodes) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      setCopyStatus("Recovery codes copied. Store them somewhere safe.");
    } catch {
      setCopyStatus("Copy is unavailable. Select the recovery codes below and save them securely.");
    }
  }

  function downloadCodes() {
    if (!recoveryCodes) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          "CBPUPSIS faculty recovery codes\nKeep these private. Each code may be used only once.\n\n",
          recoveryCodes.join("\n"),
        ],
        { type: "text/plain" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "cbpupsis-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
    setCopyStatus("Recovery codes downloaded. Store the file somewhere safe.");
  }

  async function finishEnrollment() {
    reset();
    await navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="faculty-page">
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
                {recoveryCodes
                  ? "Keep your account accessible and secure."
                  : enrolling
                    ? "Set up your authenticator to continue."
                    : challenge
                      ? "One more step to your Faculty Portal."
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
            {error && !idError && (
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
                idError={idError}
                onSubmit={(credentials) => login.mutate(credentials)}
              />
            ) : recoveryCodes ? (
              <div className="enrollment-details">
                <h2>Your recovery codes</h2>
                <p>
                  Keep these private and somewhere safe. Each recovery code can be used only once,
                  if you lose your authenticator.
                </p>
                <ul className="recovery-codes" aria-label="Recovery codes">
                  {recoveryCodes.map((value) => (
                    <li key={value}>
                      <code>{value}</code>
                    </li>
                  ))}
                </ul>
                <div className="recovery-actions">
                  <button type="button" className="secondary-button" onClick={copyCodes}>
                    Copy codes
                  </button>
                  <button type="button" className="secondary-button" onClick={downloadCodes}>
                    Download codes
                  </button>
                </div>
                <p role="status" className="copy-status">
                  {copyStatus}
                </p>
                <button type="button" className="primary-button" onClick={finishEnrollment}>
                  I have saved my recovery codes
                </button>
              </div>
            ) : (
              <div className="second-factor">
                {enrolling && !enrollment.data && (
                  <div className="setup-intro">
                    <p>
                      Add your faculty account to an authenticator app. You will receive a setup key
                      and recovery codes to keep securely.
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
                      {useRecovery ? "Recovery code" : "Authentication code"}{" "}
                      <span className="required">*</span>
                    </label>
                    <p id="code-help">
                      {useRecovery
                        ? "Enter one of the recovery codes you saved when you set up your authenticator."
                        : "Enter the six digit code from your authenticator app."}
                    </p>
                    <input
                      id="auth-code"
                      name="code"
                      value={code}
                      onChange={(event) => {
                        setCode(
                          useRecovery
                            ? event.target.value.slice(0, 32)
                            : event.target.value.replace(/\D/g, "").slice(0, 6),
                        );
                        setEnteredWindow(codeWindow.window);
                      }}
                      inputMode={useRecovery ? "text" : "numeric"}
                      autoComplete={useRecovery ? "off" : "one-time-code"}
                      spellCheck={false}
                      maxLength={useRecovery ? 32 : 6}
                      placeholder={useRecovery ? "" : "000000"}
                      required
                      aria-describedby={useRecovery ? "code-help" : "code-help code-timing"}
                      disabled={busy || locked || expired}
                    />
                    {!useRecovery && (
                      <p id="code-timing" className="timing">
                        Code refreshes in{" "}
                        <span role="timer">{formatTime(codeWindow.remaining)}</span>. Follow the
                        timer in your app.
                        {codeChanged &&
                          " The previous code window has ended. Enter the current code."}
                      </p>
                    )}
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={busy || locked || expired || !codeLength}
                    >
                      {enrolling ? "Verify authenticator" : "Verify and sign in"}
                    </button>
                    {!enrolling && (
                      <button
                        type="button"
                        className="back-button"
                        onClick={() => {
                          setUseRecovery(!useRecovery);
                          setCode("");
                          verification.reset();
                        }}
                        disabled={busy}
                      >
                        {useRecovery ? "Use your authenticator app" : "Use a recovery code"}
                      </button>
                    )}
                  </form>
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
