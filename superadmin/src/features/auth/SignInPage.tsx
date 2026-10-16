import { ApiError, isChallengeRejected, isThrottled } from "@cbpupsis/shared/api";
import type { MfaChallenge, TotpSetup as Setup } from "@cbpupsis/shared/auth";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { ErrorAlert } from "./ErrorAlert";
import { usePasswordStep, useSecondFactor, useTotpEnrollment } from "./queries";
import { TotpSetup } from "./TotpSetup";
import { useCountdown } from "./useCountdown";

type Step = { kind: "password" } | { kind: "mfa"; challenge: MfaChallenge; setup?: Setup };

const inputClass =
  "min-h-11 w-full rounded-md border border-gray-400 px-3 text-base text-gray-900 " +
  "focus-visible:outline-brand-maroon focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "aria-invalid:border-red-700 disabled:bg-gray-100";

const primaryButton =
  "bg-brand-maroon focus-visible:outline-brand-maroon min-h-11 rounded-md px-4 font-semibold " +
  "text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60";

export function SignInPage() {
  const navigate = useNavigate();
  const { expired } = useSearch({ strict: false });
  const passwordStep = usePasswordStep();
  const enrollment = useTotpEnrollment();
  const secondFactor = useSecondFactor();
  const [step, setStep] = useState<Step>({ kind: "password" });
  // Why the user is back at the password step, when it was not their choice.
  const [restartReason, setRestartReason] = useState<unknown>();
  const [code, setCode] = useState("");
  const [missing, setMissing] = useState<{ email?: boolean; password?: boolean }>({});
  const headingRef = useRef<HTMLHeadingElement>(null);

  const error = restartReason ?? secondFactor.error ?? enrollment.error ?? passwordStep.error;
  const remaining = useCountdown(isThrottled(error) ? error.retryAt : undefined);
  const waiting = remaining !== undefined && remaining > 0;
  const busy = passwordStep.isPending || enrollment.isPending || secondFactor.isPending;
  const enrolling = step.kind === "mfa" && step.challenge.enrollmentRequired;

  // Move focus to the new step's heading so screen readers announce it.
  useEffect(() => {
    if (step.kind === "mfa") headingRef.current?.focus();
  }, [step.kind]);

  function restart(reason?: unknown) {
    passwordStep.reset();
    enrollment.reset();
    secondFactor.reset();
    setCode("");
    setRestartReason(reason);
    setStep({ kind: "password" });
  }

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || waiting) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    setMissing({ email: !email, password: !password });
    if (!email || !password) {
      form.querySelector<HTMLElement>(`[name="${!email ? "email" : "password"}"]`)?.focus();
      return;
    }
    setRestartReason(undefined);
    passwordStep.mutate(
      { email, password },
      {
        onSuccess: (challenge) => {
          setStep({ kind: "mfa", challenge });
          if (challenge.enrollmentRequired) {
            enrollment.mutate(challenge.challengeToken, {
              onSuccess: (setup) => setStep({ kind: "mfa", challenge, setup }),
            });
          }
        },
        onError: () => {
          const field = form.elements.namedItem("password");
          if (field instanceof HTMLInputElement) field.value = "";
        },
      },
    );
  }

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.kind !== "mfa" || busy || waiting || code.length !== 6) return;
    secondFactor.mutate(
      { challengeToken: step.challenge.challengeToken, code, enrolling },
      {
        onSuccess: () => navigate({ to: "/dashboard", replace: true }),
        onError: (failure) => {
          setCode("");
          // An expired or superseded challenge cannot be retried; only a new sign-in helps.
          if (isChallengeRejected(failure)) restart(failure);
        },
      },
    );
  }

  const title =
    step.kind === "password"
      ? "Superadmin sign-in"
      : enrolling
        ? "Set up two-step verification"
        : "Two-step verification";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-brand-maroon text-sm font-semibold tracking-wide uppercase">
          CBPUPSIS Superadmin
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-2xl font-bold text-gray-900">
          {title}
        </h1>

        <div className="mt-4 flex flex-col gap-4">
          {expired && !error && step.kind === "password" && (
            <p role="status" className="rounded-md bg-amber-50 p-3 text-amber-900">
              Your session ended after a period of inactivity. Sign in again.
            </p>
          )}
          {error !== null && error !== undefined && <ErrorAlert error={error} />}

          {step.kind === "password" ? (
            <form noValidate onSubmit={submitPassword} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <label htmlFor="email" className="font-medium text-gray-900">
                  Email{" "}
                  <span aria-hidden="true" className="text-red-700">
                    *
                  </span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  aria-invalid={Boolean(missing.email)}
                  aria-describedby={missing.email ? "email-error" : undefined}
                  className={inputClass}
                />
                {missing.email && (
                  <p id="email-error" className="text-sm text-red-700">
                    Enter your email.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="password" className="font-medium text-gray-900">
                  Password{" "}
                  <span aria-hidden="true" className="text-red-700">
                    *
                  </span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  aria-invalid={Boolean(missing.password)}
                  aria-describedby={missing.password ? "password-error" : undefined}
                  className={inputClass}
                />
                {missing.password && (
                  <p id="password-error" className="text-sm text-red-700">
                    Enter your password.
                  </p>
                )}
              </div>
              <button type="submit" disabled={busy || waiting} className={primaryButton}>
                {passwordStep.isPending ? "Checking…" : "Continue"}
              </button>
            </form>
          ) : (
            <>
              {enrolling && enrollment.isPending && (
                <p role="status">Preparing your authenticator setup…</p>
              )}
              {enrolling && step.setup && <TotpSetup setup={step.setup} />}
              {(!enrolling || step.setup) && (
                <form noValidate onSubmit={submitCode} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="code" className="font-medium text-gray-900">
                      Authentication code{" "}
                      <span aria-hidden="true" className="text-red-700">
                        *
                      </span>
                    </label>
                    <p id="code-hint" className="text-sm text-gray-600">
                      Enter the six-digit code shown in your authenticator app.
                    </p>
                    <input
                      id="code"
                      name="code"
                      value={code}
                      onChange={(event) =>
                        setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      aria-describedby="code-hint"
                      aria-invalid={
                        secondFactor.error instanceof ApiError &&
                        secondFactor.error.code?.startsWith("AUTH_MFA")
                      }
                      className={`${inputClass} font-mono tracking-widest`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy || waiting || code.length !== 6}
                    className={primaryButton}
                  >
                    {secondFactor.isPending
                      ? "Verifying…"
                      : enrolling
                        ? "Confirm and sign in"
                        : "Verify and sign in"}
                  </button>
                </form>
              )}
              <button
                type="button"
                onClick={() => restart()}
                disabled={busy}
                className="text-brand-maroon min-h-11 self-start underline"
              >
                Back to sign-in
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
