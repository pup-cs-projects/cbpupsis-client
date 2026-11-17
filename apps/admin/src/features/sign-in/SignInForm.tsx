import { signInStyles, submitButtonClass } from "@cbpupsis/account";
import type { AdminCredentials } from "@cbpupsis/shared/auth";
import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

export function SignInForm({
  disabled,
  busy = false,
  onSubmit,
}: {
  disabled: boolean;
  /** A request is running: the button says so and shows progress. */
  busy?: boolean;
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
          <label htmlFor="email" className={signInStyles.label}>
            Email <span className="required">*</span>
          </label>
          <input
            id="email"
            name="email"
            autoComplete="username"
            type="email"
            placeholder="name@pup.edu.ph"
            required
            className={signInStyles.input}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <p id="email-error" className="field-error" role="alert">
              {errors.email}
            </p>
          )}
        </div>
        <div className={`field-group password-group ${signInStyles.passwordGroup}`}>
          <label htmlFor="password" className={signInStyles.label}>
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
              className={signInStyles.input}
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
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
                <circle cx="12" cy="12" r="3" />
                {/* Slashed while the password is hidden. */}
                {!visible && <path d="M4 4l16 16" />}
              </svg>
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="field-error" role="alert">
              {errors.password}
            </p>
          )}
          <Link to="/forgot-password" className={signInStyles.forgotPassword}>
            Forgot Password?
          </Link>
        </div>
        <div className={signInStyles.submitArea}>
          <div className={signInStyles.submitStack}>
            {/* Reserves the line the student page uses for its message, so the spacing matches. */}
            <div aria-live="assertive" className={signInStyles.messageLine} />
            <button type="submit" className={submitButtonClass(busy)}>
              {busy ? "Signing in…" : "Sign in to Portal"}
            </button>
          </div>
        </div>
      </fieldset>
    </form>
  );
}
