import { ApiError } from "@cbpupsis/shared/api";
import { CHANGE_PASSWORD_POLICY, checkPassword, meetsPolicy } from "@cbpupsis/shared/auth";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";

import { AuthShell } from "./AuthShell";
import { ErrorAlert } from "./ErrorAlert";
import { PasswordField } from "./fields";
import { PasswordChecklist } from "./PasswordChecklist";
import { CONFIRMATION_DELAY_MS, PORTAL } from "./portal";
import { useSignOut } from "./useAdminAuth";
import { SubmitButton } from "./SubmitButton";
import { useCheckedField } from "./useCheckedField";
import { useChangePassword } from "./usePasswordRecovery";
import { useStepHeading } from "./useStepHeading";

const requireCurrent = (value: string) => (value ? undefined : "Enter your temporary password.");

/**
 * The first sign-in step for an account holding a temporary password: the API answers every
 * other route 403 PASSWORD_CHANGE_REQUIRED until it is replaced. Needs the signed-in session.
 */
export function ChangePasswordPage() {
  const navigate = useNavigate();
  const change = useChangePassword();
  const signOut = useSignOut();
  const current = useCheckedField(requireCurrent);
  const [password, setPassword] = useState("");
  const [checked, setChecked] = useState(false);
  const currentInput = useRef<HTMLInputElement>(null);
  const newInput = useRef<HTMLInputElement>(null);
  const step = change.isSuccess ? "done" : "form";
  const heading = useStepHeading(step);

  const checks = checkPassword(CHANGE_PASSWORD_POLICY, password, { current: current.value });
  const ready = meetsPolicy(checks);
  const newError =
    checked && !ready
      ? password
        ? "Your new password does not meet every rule yet."
        : "Enter a new password."
      : undefined;
  const code = change.error instanceof ApiError ? change.error.code : undefined;

  useEffect(() => {
    if (step !== "done") return;
    const timer = window.setTimeout(
      () =>
        void navigate({ to: "/dashboard", search: { notice: "password-changed" }, replace: true }),
      CONFIRMATION_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [step, navigate]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (change.isPending) return;
    setChecked(true);
    const currentProblem = current.check();
    if (currentProblem || !ready) {
      (currentProblem ? currentInput : newInput).current?.focus();
      return;
    }
    change.mutate(
      { currentPassword: current.value, newPassword: password },
      {
        onError: (error) => {
          // Keep nothing of a refused password. Flushed first, so moving focus below does not
          // re-check a field that still shows the old text.
          flushSync(() => {
            current.clear();
            setPassword("");
            setChecked(false);
          });
          if (!(error instanceof ApiError)) return;
          if (error.code === "CURRENT_PASSWORD_INCORRECT") currentInput.current?.focus();
          if (error.code === "AUTH_PASSWORD_TOO_WEAK") newInput.current?.focus();
        },
      },
    );
  }

  return (
    <AuthShell busy={change.isPending} skipLabel="Skip to password change">
      {step === "form" ? (
        <div className="auth-step" key="form">
          <header>
            <h1 id="auth-title" tabIndex={-1} ref={heading}>
              Choose your own password
            </h1>
            <p className="auth-subtitle">
              Your account has a temporary password. Replace it to continue to the {PORTAL.name}.
            </p>
          </header>
          <form className="sign-in-form account-form" onSubmit={submit} noValidate>
            <PasswordField
              id="current-password"
              name="current-password"
              label="Temporary password"
              hint="From the email with your account details."
              autoComplete="current-password"
              value={current.value}
              onChange={current.onChange}
              onBlur={current.onBlur}
              error={current.error}
              inputRef={currentInput}
            />
            <PasswordField
              id="new-password"
              name="new-password"
              label="New password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onBlur={(event) => event.target.value && setChecked(true)}
              error={newError}
              describedBy="new-password-rules"
              inputRef={newInput}
            />
            <PasswordChecklist id="new-password-rules" checks={checks} />
            <SubmitButton busy={change.isPending}>Change password</SubmitButton>
            {change.error && (
              <ErrorAlert error={change.error}>
                {code === "AUTH_TEMPORARY_PASSWORD_EXPIRED" && (
                  <p>
                    <Link to="/forgot-password" className="inline-link">
                      Reset your password
                    </Link>
                  </p>
                )}
              </ErrorAlert>
            )}
          </form>
          <button
            type="button"
            className="back-button"
            disabled={signOut.isPending}
            onClick={() => signOut.mutate()}
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="auth-step" key="done">
          <header>
            <h1 id="auth-title" tabIndex={-1} ref={heading}>
              Password changed
            </h1>
          </header>
          <p className="auth-notice" role="status">
            Your new password is set. Opening the {PORTAL.name}.
          </p>
        </div>
      )}
    </AuthShell>
  );
}
