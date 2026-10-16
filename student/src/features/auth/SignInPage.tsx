import { ApiError, errorMessage, isThrottled } from "@cbpupsis/shared/api";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { useSignIn } from "./queries";
import { formatTime, useCountdown } from "./useCountdown";

type Field = "studentNumber" | "birthdate" | "password";
type FieldErrors = Partial<Record<Field, string>>;

const REQUIRED: Record<Field, string> = {
  studentNumber: "Enter your student number.",
  birthdate: "Enter your birthdate.",
  password: "Enter your password.",
};

const inputClass =
  "min-h-11 w-full rounded-md border border-gray-400 px-3 text-base text-gray-900 " +
  "focus-visible:outline-brand-maroon focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "aria-invalid:border-red-700 disabled:bg-gray-100";

export function SignInPage() {
  const navigate = useNavigate();
  const { expired } = useSearch({ strict: false });
  const signIn = useSignIn();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);

  const error = signIn.error;
  const throttled = isThrottled(error) ? error : undefined;
  const remaining = useCountdown(throttled?.retryAt);
  const waiting = remaining !== undefined && remaining > 0;
  // A malformed student number is a field problem, not a sign-in failure (AC-101.2).
  const formatError = error instanceof ApiError && error.code === "AUTH_ID_FORMAT_INVALID";
  const studentNumberError = fieldErrors.studentNumber ?? (formatError ? errorMessage(error) : "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signIn.isPending || waiting) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const values = {
      studentNumber: String(data.get("studentNumber") ?? "").trim(),
      birthdate: String(data.get("birthdate") ?? ""),
      password: String(data.get("password") ?? ""),
    };
    const missing = (Object.keys(REQUIRED) as Field[]).filter((field) => !values[field]);
    setFieldErrors(Object.fromEntries(missing.map((field) => [field, REQUIRED[field]])));
    if (missing.length) {
      form.querySelector<HTMLElement>(`[name="${missing[0]}"]`)?.focus();
      return;
    }
    signIn.mutate(values, {
      onSuccess: () => navigate({ to: "/dashboard", replace: true }),
      onError: () => {
        // Never keep a password around after a failed attempt.
        const password = form.elements.namedItem("password");
        if (password instanceof HTMLInputElement) password.value = "";
      },
    });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-brand-maroon text-sm font-semibold tracking-wide uppercase">
          Polytechnic University of the Philippines
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Student sign-in</h1>
        <p className="mt-1 text-gray-700">Sign in to CBPUPSIS with your student number.</p>

        {expired && !error && (
          <p role="status" className="mt-4 rounded-md bg-amber-50 p-3 text-amber-900">
            {errorMessage(new ApiError(401, "AUTH_SESSION_EXPIRED"))}
          </p>
        )}

        {error && !formatError && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-red-900"
          >
            <p>{errorMessage(error)}</p>
            {throttled && remaining !== undefined && (
              <p className="mt-1">
                {waiting ? (
                  <>
                    Try again in <span role="timer">{formatTime(remaining)}</span>.
                  </>
                ) : (
                  "You can try again now."
                )}
              </p>
            )}
            {error instanceof ApiError && error.requestId && (
              <p className="mt-1 text-sm">Reference: {error.requestId}</p>
            )}
          </div>
        )}

        <form noValidate onSubmit={submit} className="mt-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <label htmlFor="student-number" className="font-medium text-gray-900">
              Student number{" "}
              <span aria-hidden="true" className="text-red-700">
                *
              </span>
            </label>
            <p id="student-number-hint" className="text-sm text-gray-600">
              For example, 2021-00123-MN-0
            </p>
            <input
              id="student-number"
              name="studentNumber"
              autoComplete="username"
              autoCapitalize="characters"
              spellCheck={false}
              required
              aria-invalid={Boolean(studentNumberError)}
              aria-describedby={
                studentNumberError
                  ? "student-number-hint student-number-error"
                  : "student-number-hint"
              }
              className={inputClass}
            />
            {studentNumberError && (
              <p id="student-number-error" className="text-sm text-red-700">
                {studentNumberError}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="birthdate" className="font-medium text-gray-900">
              Birthdate{" "}
              <span aria-hidden="true" className="text-red-700">
                *
              </span>
            </label>
            <input
              id="birthdate"
              name="birthdate"
              type="date"
              autoComplete="bday"
              required
              aria-invalid={Boolean(fieldErrors.birthdate)}
              aria-describedby={fieldErrors.birthdate ? "birthdate-error" : undefined}
              className={inputClass}
            />
            {fieldErrors.birthdate && (
              <p id="birthdate-error" className="text-sm text-red-700">
                {fieldErrors.birthdate}
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
            <div className="flex gap-2">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-pressed={showPassword}
                aria-controls="password"
                className="focus-visible:outline-brand-maroon min-h-11 min-w-16 rounded-md border border-gray-400 px-3 text-sm font-medium text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {showPassword ? "Hide" : "Show"}
                <span className="sr-only"> password</span>
              </button>
            </div>
            {fieldErrors.password && (
              <p id="password-error" className="text-sm text-red-700">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={signIn.isPending || waiting}
            className="bg-brand-maroon focus-visible:outline-brand-maroon min-h-11 rounded-md px-4 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
          >
            {signIn.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-700">
          Trouble signing in? Contact the University Registrar or{" "}
          <a className="text-brand-maroon underline" href="mailto:icto-admin@pup.edu.ph">
            icto-admin@pup.edu.ph
          </a>
          .
        </p>
      </div>
    </main>
  );
}
