import type { FacultyCredentials } from "@cbpupsis/shared/auth";
import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

export function SignInForm({
  onSubmit,
  disabled,
  idError,
}: {
  onSubmit: (credentials: FacultyCredentials) => void;
  disabled: boolean;
  /** Shown under the id when the API answers AUTH_ID_FORMAT_INVALID. */
  idError?: string;
}) {
  const [visible, setVisible] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    onSubmit({
      employeeId: String(data.get("employee_id")).trim(),
      password: String(data.get("password")),
    });
    // Credentials are never retained in browser storage.
    const password = form.elements.namedItem("password");
    if (password instanceof HTMLInputElement) password.value = "";
  }
  return (
    <form onSubmit={submit} className="sign-in-form">
      <fieldset disabled={disabled} className="form-fields">
        <div className="field-group">
          <label htmlFor="faculty-id">
            Faculty ID <span className="required">*</span>
          </label>
          <input
            id="faculty-id"
            name="employee_id"
            placeholder="2021-00456-MN-0"
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck={false}
            required
            aria-invalid={Boolean(idError)}
            aria-describedby={idError ? "faculty-id-error" : undefined}
          />
          {idError && (
            <p id="faculty-id-error" className="field-error">
              {idError}
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
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setVisible(!visible)}
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
                {!visible && <path d="m3 21 18-18" />}
              </svg>
            </button>
          </div>
          <Link to="/forgot-password" className="forgot-password">
            Forgot password?
          </Link>
        </div>
        <button type="submit" className="primary-button">
          Sign in to Portal
        </button>
      </fieldset>
    </form>
  );
}
