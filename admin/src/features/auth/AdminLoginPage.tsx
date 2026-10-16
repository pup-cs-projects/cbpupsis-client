import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import logo from "../../assets/pup-logo.png";
import { AuthError } from "../../lib/auth-api";
import { AuthSkeleton } from "./AuthSkeleton";
import { SignInForm } from "./SignInForm";
import { useAdminAuth } from "./useAdminAuth";
import { formatTime, useCountdown, useCodeWindow } from "./useCountdown";
import "./auth.css";

function errorMessage(error: Error) {
  if (!(error instanceof AuthError)) return "Unable to sign in. Please try again.";
  switch (error.code) {
    case "AUTH_INSUFFICIENT_ROLE":
      return "This action is not available to your role. Contact ICTO or your system administrator.";
    case "RESOURCE_NOT_FOUND":
      return "Record not found. Check the link or return to your dashboard.";
    case "AUTH_MFA_ENROLLMENT_REQUIRED":
      return "Set up a second factor before accessing administrative functions. Start again to continue setup.";
    case "WEBAUTHN_UNAVAILABLE":
      return "Security keys are unavailable in this browser. Use a supported browser over HTTPS or your authenticator app.";
    case "WEBAUTHN_CANCELLED":
      return "Security key verification was cancelled or timed out. Try again.";
    case "AUTH_ACCOUNT_LOCKED":
      return "Sign-in is temporarily locked. Please wait before trying again.";
    case "AUTH_MFA_INVALID":
      return "Unable to sign in. The code may have expired. Enter the current code from your authenticator app, or start again.";
    case "AUTH_MFA_EXPIRED":
    case "AUTH_MFA_CODE_EXPIRED":
      return "The code has expired. Enter the current code from your authenticator app.";
    case "AUTH_CHALLENGE_EXPIRED":
    case "AUTH_MFA_CHALLENGE_EXPIRED":
      return "This sign-in request has expired. Start again to continue.";
    case "SERVICE_UNAVAILABLE":
      return "Unable to connect securely. Check your connection and try again.";
    case "ENROLLMENT_UNAVAILABLE":
      return "Authenticator setup is unavailable. Try again or contact ICTO for help.";
    case "INVALID_RESPONSE":
      return "Sign-in could not be completed. Please try again or contact ICTO.";
    default:
      return "Unable to sign in with the details provided. Check your details and try again.";
  }
}

export function AdminLoginPage() {
  const { login, enrollment, confirmation, verification, securityKey } = useAdminAuth();
  const navigate = useNavigate();
  const [savedCodes, setSavedCodes] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [code, setCode] = useState("");
  const [enteredWindow, setEnteredWindow] = useState<number>();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const challenge = login.data?.kind === "challenge" ? login.data : undefined;
  const error =
    securityKey.error ||
    verification.error ||
    confirmation.error ||
    enrollment.error ||
    login.error;
  const lockError =
    error instanceof AuthError &&
    ["AUTH_ACCOUNT_LOCKED", "rate_limited", "RATE_LIMIT_EXCEEDED"].includes(error.code)
      ? error
      : undefined;
  const remainingLock = useCountdown(lockError?.retryAt);
  const remainingChallenge = useCountdown(challenge?.expiresAt);
  const codeWindow = useCodeWindow(enrollment.data?.period ?? 30);
  const codeChanged =
    code.length > 0 && enteredWindow !== undefined && enteredWindow !== codeWindow.window;
  const expired =
    remainingChallenge === 0 ||
    (error instanceof AuthError &&
      ["AUTH_CHALLENGE_EXPIRED", "AUTH_MFA_CHALLENGE_EXPIRED"].includes(error.code));
  const locked = Boolean(lockError && (remainingLock === undefined || remainingLock > 0));
  const enrolling = challenge?.enrollmentRequired === true;
  const busy =
    login.isPending ||
    enrollment.isPending ||
    confirmation.isPending ||
    verification.isPending ||
    securityKey.isPending;
  const title =
    confirmation.data && !savedCodes
      ? "Save your recovery codes"
      : enrolling && !confirmation.data
        ? "Secure your account"
        : challenge
          ? "Two-step verification"
          : "Admin Portal";

  useEffect(() => {
    if (challenge) headingRef.current?.focus();
  }, [challenge, title]);

  function reset() {
    securityKey.reset();
    login.reset();
    enrollment.reset();
    confirmation.reset();
    verification.reset();
    setCode("");
    setSavedCodes(false);
    setCopyStatus("");
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || locked || expired || busy) return;
    securityKey.reset();
    try {
      if (enrolling && !confirmation.data) {
        await confirmation.mutateAsync({ token: challenge.challengeToken, code });
        setCode("");
        enrollment.reset();
        return;
      }
      const result = await verification.mutateAsync({ token: challenge.challengeToken, code });
      setCode("");
      if (result.kind === "session") {
        reset();
        await navigate({ to: "/dashboard" });
      }
    } catch {
      setCode("");
    }
  }

  async function copyCodes() {
    if (!confirmation.data) return;
    try {
      await navigator.clipboard.writeText(confirmation.data.join("\n"));
      setCopyStatus("Recovery codes copied. Store them somewhere safe.");
    } catch {
      setCopyStatus("Copy is unavailable. Select the recovery codes below and save them securely.");
    }
  }

  function downloadCodes() {
    if (!confirmation.data) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          "CBPUPSIS admin recovery codes\nKeep these private. Each code may be used only once.\n\n",
          confirmation.data.join("\n"),
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
                {confirmation.data
                  ? "Keep your account accessible and secure."
                  : enrolling
                    ? "Set up your authenticator to continue."
                    : challenge
                      ? "One more step to your Admin Portal."
                      : "Login and stay connected."}
              </p>
            </header>
            <div aria-live="polite" aria-atomic="true" className="sr-only">
              {remainingChallenge === 0 ? "Your sign-in request has expired." : ""}
              {codeChanged
                ? "The previous code window has ended. Use the current code in your app."
                : ""}
              {remainingLock === 0
                ? "The waiting period has ended. You can try signing in again."
                : ""}
            </div>
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
                {error instanceof AuthError && error.requestId && (
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
                {enrolling && !enrollment.data && !confirmation.data && (
                  <div className="setup-intro">
                    <p>
                      Add your admin account to an authenticator app. You will receive a setup key
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
                    <p>In your authenticator app, add an account using this setup key.</p>
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
                      <br />
                      Issuer: {enrollment.data.issuer}
                    </p>
                  </div>
                )}
                {confirmation.data && !savedCodes && (
                  <div className="enrollment-details">
                    <h2>Your recovery codes</h2>
                    <p>
                      Keep these private and somewhere safe. Each recovery code can be used only
                      once.
                    </p>
                    <ul className="recovery-codes" aria-label="Recovery codes">
                      {confirmation.data.map((value, index) => (
                        <li key={index}>
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
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => setSavedCodes(true)}
                    >
                      I have saved my recovery codes
                    </button>
                  </div>
                )}
                {((!enrolling && challenge.methods.includes("totp")) ||
                  enrollment.data ||
                  savedCodes) && (
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
                      pattern="[0-9]{6}"
                      minLength={6}
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
                      {savedCodes && " Use a new code after the one used for setup."}
                    </p>
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={busy || locked || expired || code.length !== 6}
                    >
                      {enrolling && !confirmation.data
                        ? "Verify authenticator"
                        : "Verify and sign in"}
                    </button>
                  </form>
                )}
                {!enrolling && challenge.methods.includes("webauthn") && (
                  <button
                    type="button"
                    className="secondary-button security-key"
                    disabled={busy || locked || expired}
                    onClick={async () => {
                      verification.reset();
                      try {
                        await securityKey.mutateAsync(challenge.challengeToken);
                        reset();
                        await navigate({ to: "/dashboard" });
                      } catch {
                        /* Announced by the shared error region. */
                      }
                    }}
                  >
                    Use a security key
                  </button>
                )}
                {!enrolling && challenge.methods.length === 0 && (
                  <p role="status">
                    No supported verification method is available. Contact ICTO for assistance.
                  </p>
                )}
                {remainingChallenge !== undefined && (
                  <p className="challenge-timer">
                    {expired ? (
                      "This sign-in request has expired."
                    ) : (
                      <>
                        Sign-in request expires in{" "}
                        <span role="timer">{formatTime(remainingChallenge)}</span>.
                      </>
                    )}
                  </p>
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
