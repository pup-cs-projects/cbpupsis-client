import { ApiError, errorMessage, isThrottled } from "@cbpupsis/shared/api";
import { Link } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";

import { AuthShell } from "./AuthShell";
import { ErrorAlert } from "./ErrorAlert";
import { TextField } from "./fields";
import { SubmitButton } from "./SubmitButton";
import { useCheckedField } from "./useCheckedField";
import { formatTime, useCountdown } from "./useCountdown";
import { useRequestReset } from "./usePasswordRecovery";
import { useStepHeading } from "./useStepHeading";

// Feedback only; the API decides (400 INVALID_EMAIL_ADDRESS).
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value: string) {
  const email = value.trim();
  if (!email) return "Enter your email address.";
  if (!EMAIL_SHAPE.test(email)) return errorMessage(new ApiError(400, "INVALID_EMAIL_ADDRESS"));
  return undefined;
}

/**
 * Request a reset link (US-105). Whatever address is entered, a sent request ends on the same
 * confirmation, so the page never tells anyone whether an account exists.
 */
export function ForgotPasswordPage() {
  const request = useRequestReset();
  const email = useCheckedField(validateEmail);
  const emailInput = useRef<HTMLInputElement>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const heading = useStepHeading(sentTo ? "sent" : "request");

  const error = request.error;
  const throttle = isThrottled(error) ? error : undefined;
  const remaining = useCountdown(throttle?.retryAt);
  const waiting = Boolean(throttle && remaining !== undefined && remaining > 0);
  const refusedEmail =
    error instanceof ApiError &&
    error.code === "INVALID_EMAIL_ADDRESS" &&
    request.variables === email.value.trim();
  const fieldError = email.error ?? (refusedEmail ? errorMessage(error) : undefined);

  function send(address: string, onSent: () => void) {
    if (request.isPending || waiting) return;
    request.mutate(address, { onSuccess: onSent });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email.check()) {
      emailInput.current?.focus();
      return;
    }
    const address = email.value.trim();
    send(address, () => {
      setResent(false);
      setSentTo(address);
    });
  }

  const alert = error && !refusedEmail && (
    <ErrorAlert error={error}>
      {throttle && remaining !== undefined && (
        <p>
          {remaining > 0 ? (
            <>
              Try again in{" "}
              <span role="timer" aria-label="Time before you can try again">
                {formatTime(remaining)}
              </span>
              .
            </>
          ) : (
            "You can try again now."
          )}
        </p>
      )}
    </ErrorAlert>
  );

  return (
    <AuthShell busy={request.isPending} skipLabel="Skip to password reset">
      {sentTo === null ? (
        <div className="auth-step" key="request">
          <header>
            <h1 id="auth-title" tabIndex={-1} ref={heading}>
              Reset your password
            </h1>
            <p className="auth-subtitle">We will email you a link to choose a new password.</p>
          </header>
          <form className="sign-in-form account-form" onSubmit={submit} noValidate>
            <TextField
              id="reset-email"
              name="email"
              type="email"
              label="Email address"
              hint="Use the email address where you received your CBPUPSIS account details."
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="name@pup.edu.ph"
              value={email.value}
              onChange={email.onChange}
              onBlur={email.onBlur}
              error={fieldError}
              inputRef={emailInput}
            />
            <SubmitButton busy={request.isPending} blocked={waiting}>
              Send reset link
            </SubmitButton>
            {alert}
          </form>
          <Link to="/" className="back-link">
            Back to sign in
          </Link>
        </div>
      ) : (
        <div className="auth-step" key="sent">
          <header>
            <h1 id="auth-title" tabIndex={-1} ref={heading}>
              Check your email
            </h1>
            <p className="auth-subtitle">
              If <strong className="sent-address">{sentTo}</strong> belongs to a CBPUPSIS account, a
              reset link is on its way.
            </p>
          </header>
          <div className="account-form">
            <p className="step-text">
              Open the link in that email to choose a new password. Each link works once.
            </p>
            <p className="step-text">
              No email after a few minutes? Check your spam folder, then send another link.
            </p>
            <SubmitButton
              type="button"
              className="secondary-button"
              busy={request.isPending}
              blocked={waiting}
              onClick={() => send(sentTo, () => setResent(true))}
            >
              Send another link
            </SubmitButton>
            <p className="step-text" role="status">
              {resent && !error ? `Another link was sent to ${sentTo}.` : ""}
            </p>
            {alert}
            <button
              type="button"
              className="back-button"
              onClick={() => {
                request.reset();
                setSentTo(null);
              }}
            >
              Use a different email address
            </button>
          </div>
          <Link to="/" className="back-link">
            Back to sign in
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
