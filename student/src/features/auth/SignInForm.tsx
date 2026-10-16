import type { StudentCredentials } from "@cbpupsis/shared/auth";
import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

type Field = keyof StudentCredentials;

const REQUIRED: Record<Field, string> = {
  studentNumber: "Enter your student number.",
  birthdate: "Enter your birthdate.",
  password: "Enter your password.",
};

export function SignInForm({
  disabled,
  onSubmit,
  idError,
}: {
  disabled: boolean;
  onSubmit: (credentials: StudentCredentials) => void;
  /** Shown under the student number when the API answers AUTH_ID_FORMAT_INVALID. */
  idError?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const studentNumberError = errors.studentNumber ?? idError;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const values: StudentCredentials = {
      studentNumber: String(data.get("studentNumber") ?? "").trim(),
      // Required on every student sign-in.
      birthdate: String(data.get("birthdate") ?? ""),
      password: String(data.get("password") ?? ""),
    };
    const missing = (Object.keys(REQUIRED) as Field[]).filter((field) => !values[field]);
    setErrors(Object.fromEntries(missing.map((field) => [field, REQUIRED[field]])));
    if (missing.length) {
      form.querySelector<HTMLElement>(`[name="${missing[0]}"]`)?.focus();
      return;
    }
    onSubmit(values);
    // Credentials are never retained in browser storage.
    const password = form.elements.namedItem("password");
    if (password instanceof HTMLInputElement) password.value = "";
  }

  return (
    <form className="sign-in-form" onSubmit={submit} noValidate>
      <fieldset className="form-fields" disabled={disabled}>
        <legend className="sr-only">Student credentials</legend>
        <div className="field-group">
          <label htmlFor="student-number">
            Student number <span className="required">*</span>
          </label>
          <input
            id="student-number"
            name="studentNumber"
            placeholder="2021-00123-MN-0"
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck={false}
            required
            aria-invalid={Boolean(studentNumberError)}
            aria-describedby={studentNumberError ? "student-number-error" : undefined}
          />
          {studentNumberError && (
            <p id="student-number-error" className="field-error">
              {studentNumberError}
            </p>
          )}
        </div>
        <div className="field-group">
          <label htmlFor="birthdate">
            Birthdate <span className="required">*</span>
          </label>
          <input
            id="birthdate"
            name="birthdate"
            type="date"
            autoComplete="bday"
            required
            aria-invalid={Boolean(errors.birthdate)}
            aria-describedby={errors.birthdate ? "birthdate-error" : undefined}
          />
          {errors.birthdate && (
            <p id="birthdate-error" className="field-error">
              {errors.birthdate}
            </p>
          )}
        </div>
        <div className="field-group password-group">
          <label htmlFor="password">
            Password <span className="required">*</span>
          </label>
          <div className="password-input">
            <input
              id="password"
              name="password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              required
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setVisible(!visible)}
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
                {!visible && <path d="m3 21 18-18" />}
              </svg>
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="field-error">
              {errors.password}
            </p>
          )}
        </div>
        <Link to="/forgot-password" className="forgot-password">
          Forgot password?
        </Link>
        <button type="submit" className="primary-button">
          Sign in to Portal
        </button>
      </fieldset>
    </form>
  );
}
