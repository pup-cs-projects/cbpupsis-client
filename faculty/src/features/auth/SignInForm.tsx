import { useState, type FormEvent } from "react";
import type { Credentials } from "./types";

const months = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, "0"),
  label: new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2000, index, 1)),
}));
const currentYear = new Date().getFullYear();

export function SignInForm({
  onSubmit,
  disabled,
}: {
  onSubmit: (credentials: Credentials) => void;
  disabled: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [dateError, setDateError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const year = String(data.get("year"));
    const month = String(data.get("month"));
    const day = String(data.get("day"));
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) {
      setDateError("Enter a valid date of birth.");
      return;
    }
    setDateError("");
    onSubmit({
      employee_id: String(data.get("employee_id")).trim(),
      password: String(data.get("password")),
      date_of_birth: `${year}-${month}-${day}`,
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
            placeholder="202X-XXXX-MN-0"
            autoComplete="username"
            required
          />
        </div>
        <fieldset
          className="birth-date"
          aria-describedby={dateError ? "birth-date-error" : undefined}
        >
          <legend>
            Date of Birth <span className="required">*</span>
          </legend>
          <div className="date-fields">
            <select
              name="month"
              aria-label="Birth month"
              autoComplete="bday-month"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Month
              </option>
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
            <select
              name="day"
              aria-label="Birth day"
              autoComplete="bday-day"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Day
              </option>
              {Array.from({ length: 31 }, (_, index) => (
                <option key={index} value={String(index + 1).padStart(2, "0")}>
                  {index + 1}
                </option>
              ))}
            </select>
            <select
              name="year"
              aria-label="Birth year"
              autoComplete="bday-year"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Year
              </option>
              {Array.from({ length: 121 }, (_, index) => (
                <option key={index} value={currentYear - index}>
                  {currentYear - index}
                </option>
              ))}
            </select>
          </div>
          {dateError && (
            <p id="birth-date-error" className="field-error" role="alert">
              {dateError}
            </p>
          )}
        </fieldset>
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
          <a
            className="forgot-password"
            href="mailto:icto-admin@pup.edu.ph?subject=Faculty%20password%20assistance"
          >
            Forgot Password?
          </a>
        </div>
        <button type="submit" className="primary-button">
          Sign in to Portal
        </button>
      </fieldset>
    </form>
  );
}
