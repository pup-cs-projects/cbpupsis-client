import { ApiError, errorMessage, isThrottled } from "@cbpupsis/shared/api";
import { useNavigate, useSearch } from "@tanstack/react-router";
import logo from "../../assets/pup-logo.png";
import { AuthSkeleton } from "./AuthSkeleton";
import { useSignIn } from "./queries";
import { SignInForm } from "./SignInForm";
import { formatTime, useCountdown } from "./useCountdown";
import "./auth.css";

// Same layout as the faculty, admin, and superadmin sign-in pages.
export function SignInPage() {
  const navigate = useNavigate();
  const { expired } = useSearch({ strict: false });
  const signIn = useSignIn();

  const error = signIn.error;
  const lockError = isThrottled(error) ? error : undefined;
  const remainingLock = useCountdown(lockError?.retryAt);
  const locked = Boolean(lockError && (remainingLock === undefined || remainingLock > 0));
  // A malformed student number is a field problem, not a sign-in failure (AC-101.2).
  const idError =
    error instanceof ApiError && error.code === "AUTH_ID_FORMAT_INVALID"
      ? errorMessage(error)
      : undefined;

  return (
    <div className="student-page">
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
            className="login-card"
            aria-labelledby="auth-title"
            aria-busy={signIn.isPending}
          >
            <header>
              <h1 id="auth-title">Student Portal</h1>
              <p className="auth-subtitle">Login and stay connected.</p>
            </header>
            <div aria-live="polite" aria-atomic="true" className="sr-only">
              {remainingLock === 0
                ? "The waiting period has ended. You can try signing in again."
                : ""}
            </div>
            {expired && !error && (
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
              disabled={signIn.isPending || locked}
              idError={idError}
              onSubmit={(credentials) =>
                signIn.mutate(credentials, {
                  onSuccess: () => navigate({ to: "/dashboard", replace: true }),
                })
              }
            />
            {signIn.isPending && <AuthSkeleton />}
            <p className="account-help">
              Trouble signing in? Contact the University Registrar or{" "}
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
