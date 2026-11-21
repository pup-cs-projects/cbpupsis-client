import { ApiError } from "@cbpupsis/shared/api";
import { checkPassword, meetsPolicy, resetLinkProblem } from "@cbpupsis/shared/auth";
import {
  AuthSkeleton,
  ErrorAlert,
  PasswordChecklist,
  PasswordField,
  SubmitButton,
  useStepHeading,
} from "@cbpupsis/ui";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";

import { CONFIRMATION_DELAY_MS, useAccount } from "../context";
import { AuthShell } from "../layout/AuthShell";
import { useResetLink, useResetPassword } from "./usePasswordRecovery";

const PROBLEM_TITLES = {
  expired: "This link has expired",
  used: "This link has been used",
  invalid: "This link cannot be used",
} as const;

/** Redeem a mailed reset link (US-105): check it, then set a new password once. */
export function ResetPasswordPage({ token }: { token?: string }) {
  const { session } = useAccount();
  const navigate = useNavigate();
  const link = useResetLink(token);
  const reset = useResetPassword();
  const [password, setPassword] = useState("");
  const [checked, setChecked] = useState(false);
  const passwordInput = useRef<HTMLInputElement>(null);

  const problem = !token
    ? "invalid"
    : (resetLinkProblem(link.error) ?? resetLinkProblem(reset.error));
  const step = problem
    ? "problem"
    : link.isPending
      ? "checking"
      : link.isError
        ? "unreachable"
        : reset.isSuccess
          ? "done"
          : "form";
  const heading = useStepHeading(step);
  const checks = link.data ? checkPassword(link.data, password) : [];
  const ready = meetsPolicy(checks);
  const fieldError =
    checked && !ready
      ? password
        ? "Your password does not meet every rule yet."
        : "Enter a new password."
      : undefined;

  useEffect(() => {
    if (step !== "done") return;
    const timer = window.setTimeout(() => {
      // Every session ended on the API (AC-105.6), including one open in this tab.
      void session.signOut();
      void navigate({ to: "/", search: { notice: "password-reset" }, replace: true });
    }, CONFIRMATION_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [step, navigate, session]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || reset.isPending) return;
    setChecked(true);
    if (!ready) {
      passwordInput.current?.focus();
      return;
    }
    reset.mutate(
      { token, password },
      {
        onError: (error) => {
          // Keep nothing of a refused password. Flushed first, so moving focus below does not
          // re-check a field that still shows the old text.
          flushSync(() => {
            setPassword("");
            setChecked(false);
          });
          if (error instanceof ApiError && error.code === "AUTH_PASSWORD_TOO_WEAK") {
            passwordInput.current?.focus();
          }
        },
      },
    );
  }

  return (
    <AuthShell busy={link.isFetching || reset.isPending} skipLabel="Skip to password reset">
      {step === "checking" && (
        <div className="auth-step" key="checking">
          <header>
            <h1 id="auth-title" tabIndex={-1} ref={heading}>
              Checking your link
            </h1>
            <p className="auth-subtitle">This takes a moment.</p>
          </header>
          <AuthSkeleton />
        </div>
      )}

      {step === "unreachable" && (
        <div className="auth-step" key="unreachable">
          <header>
            <h1 id="auth-title" tabIndex={-1} ref={heading}>
              We could not check your link
            </h1>
          </header>
          <ErrorAlert error={link.error} />
          <div className="account-form">
            <SubmitButton type="button" busy={link.isFetching} onClick={() => void link.refetch()}>
              Try again
            </SubmitButton>
          </div>
          <Link to="/" className="back-link">
            Back to sign in
          </Link>
        </div>
      )}

      {step === "problem" && problem && (
        <div className="auth-step" key="problem">
          <header>
            <h1 id="auth-title" tabIndex={-1} ref={heading}>
              {PROBLEM_TITLES[problem]}
            </h1>
          </header>
          <ErrorAlert error={link.error ?? reset.error ?? new ApiError(0, "RESET_LINK_INVALID")} />
          <div className="account-form">
            <Link to="/forgot-password" className="primary-button link-button">
              Request a new link
            </Link>
          </div>
          <Link to="/" className="back-link">
            Back to sign in
          </Link>
        </div>
      )}

      {step === "form" && (
        <div className="auth-step" key="form">
          <header>
            <h1 id="auth-title" tabIndex={-1} ref={heading}>
              Choose a new password
            </h1>
            <p className="auth-subtitle">
              It replaces your old password and signs you out everywhere else.
            </p>
          </header>
          <form className="sign-in-form account-form" onSubmit={submit} noValidate>
            <PasswordField
              id="new-password"
              name="new-password"
              label="New password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onBlur={(event) => event.target.value && setChecked(true)}
              error={fieldError}
              describedBy="new-password-rules"
              inputRef={passwordInput}
            />
            <PasswordChecklist id="new-password-rules" checks={checks} />
            <SubmitButton busy={reset.isPending}>Set new password</SubmitButton>
            {reset.error && !problem && <ErrorAlert error={reset.error} />}
          </form>
        </div>
      )}

      {step === "done" && (
        <div className="auth-step" key="done">
          <header>
            <h1 id="auth-title" tabIndex={-1} ref={heading}>
              Password changed
            </h1>
          </header>
          <p className="auth-notice" role="status">
            Your new password is set. Taking you to sign in.
          </p>
        </div>
      )}
    </AuthShell>
  );
}
