import { useState, type FormEvent } from "react";
import type { AdminCredentials } from "@cbpupsis/shared/auth";

export function SignInForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (credentials: AdminCredentials) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    setErrors({
      email: email ? undefined : "Enter your email.",
      password: password ? undefined : "Enter your password.",
    });
    if (email && password) onSubmit({ email, password });
  }
  return (
    <form className="sign-in-form" onSubmit={submit} noValidate>
      <fieldset className="form-fields" disabled={disabled}>
        <legend className="sr-only">Administrator credentials</legend>
        <div className="field-group">
          <label htmlFor="email">
            Email <span className="required">*</span>
          </label>
          <input
            id="email"
            name="email"
            autoComplete="username"
            type="email"
            placeholder="name@pup.edu.ph"
            required
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p id="email-error" className="field-error" role="alert">
              {errors.email}
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
