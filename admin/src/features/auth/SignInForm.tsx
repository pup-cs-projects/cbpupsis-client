import { useState, type FormEvent } from "react";
import type { Credentials } from "./types";

export function SignInForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (credentials: Credentials) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const values = new FormData(event.currentTarget);
    const identifier = String(values.get("identifier") ?? "").trim();
    const password = String(values.get("password") ?? "");
    setErrors({
      identifier: identifier ? undefined : "Enter your administrator ID or email.",
      password: password ? undefined : "Enter your password.",
    });
    if (identifier && password) onSubmit({ identifier, password });
  }
  return (
    <form className="sign-in-form" onSubmit={submit} noValidate>
      <fieldset className="form-fields" disabled={disabled}>
        <legend className="sr-only">Administrator credentials</legend>
        <div className="field-group">
          <label htmlFor="identifier">
            Administrator ID or email <span className="required">*</span>
          </label>
          <input
            id="identifier"
            name="identifier"
            autoComplete="username"
            placeholder="Enter your ID or email"
            required
            aria-invalid={Boolean(errors.identifier)}
            aria-describedby={errors.identifier ? "identifier-error" : undefined}
          />
          {errors.identifier && (
            <p id="identifier-error" className="field-error" role="alert">
              {errors.identifier}
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
            <p id="password-error" className="field-error" role="alert">
              {errors.password}
            </p>
          )}
        </div>
        <a
          className="forgot-password"
          href="mailto:icto-admin@pup.edu.ph?subject=Administrator%20account%20assistance"
        >
          Forgot Password?
        </a>
        <button type="submit" className="primary-button">
          Sign in to Portal
        </button>
      </fieldset>
    </form>
  );
}
