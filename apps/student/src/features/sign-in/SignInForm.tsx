import type { StudentCredentials } from "@cbpupsis/shared/auth";
import { Link } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";

const INCOMPLETE = "Please complete all fields to sign in.";
// Red outline for a control flagged by aria-invalid; `!` beats the shared auth.css border.
const FLAGGED = "aria-invalid:border-red-400!";
// Type scale for the controls. Selects keep the shared dark/placeholder colour pair.
const INPUT = `${FLAGGED} text-sm! font-normal! text-gray-900!`;
const SELECT = `${FLAGGED} text-sm! font-normal! max-lg:pr-8! max-lg:pl-3!`;
const LABEL = "text-sm! font-semibold! text-white! drop-shadow-sm";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
// Birth years for college students: 16 to 60 years ago, newest first.
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 45 }, (_, i) => THIS_YEAR - 15 - i);
const DATE_PARTS = ["birthMonth", "birthDay", "birthYear"] as const;

/** The three selects as the API's YYYY-MM-DD, or "" until all three are chosen. */
function readBirthdate(data: FormData) {
  const [month, day, year] = DATE_PARTS.map((part) => String(data.get(part) ?? ""));
  if (!month || !day || !year) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** Rejects combinations the calendar doesn't have, such as 31 April. */
function isRealDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function SignInForm({
  disabled,
  onSubmit,
  idError,
  banner,
}: {
  disabled: boolean;
  onSubmit: (credentials: StudentCredentials) => void;
  /** Shown under the student number when the API answers AUTH_ID_FORMAT_INVALID. */
  idError?: string;
  /** Notice or error shown directly above the submit button; nothing is reserved when empty. */
  banner?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  // Names of the controls to outline in red, and the one line that explains why.
  const [invalid, setInvalid] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const isInvalid = (name: string) => invalid.includes(name);

  function fail(form: HTMLFormElement, names: string[], text: string) {
    setInvalid(names);
    setMessage(text);
    form.querySelector<HTMLElement>(`[name="${names[0]}"]`)?.focus();
  }

  /** Editing a flagged control clears its outline; the message goes once none are left. */
  function clear(event: FormEvent<HTMLFormElement>) {
    const name = (event.target as HTMLInputElement).name;
    const next = invalid.filter((n) =>
      name.startsWith("birth") ? !n.startsWith("birth") : n !== name,
    );
    setInvalid(next);
    if (!next.length) setMessage("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const values: StudentCredentials = {
      studentNumber: String(data.get("studentNumber") ?? "").trim(),
      // Required on every student sign-in.
      birthdate: readBirthdate(data),
      password: String(data.get("password") ?? ""),
    };
    // In page order, so focus lands on the first empty control.
    const empty = [
      ...(values.studentNumber ? [] : ["studentNumber"]),
      ...DATE_PARTS.filter((part) => !data.get(part)),
      ...(values.password ? [] : ["password"]),
    ];
    if (empty.length) return fail(form, empty, INCOMPLETE);
    if (!isRealDate(values.birthdate))
      return fail(form, ["birthDay"], "Choose a date that exists.");
    setInvalid([]);
    setMessage("");
    onSubmit(values);
    // Credentials are never retained in browser storage.
    const password = form.elements.namedItem("password");
    if (password instanceof HTMLInputElement) password.value = "";
  }

  return (
    <form className="sign-in-form" onSubmit={submit} onChange={clear} noValidate>
      <fieldset className="form-fields" disabled={disabled}>
        <legend className="sr-only">Student credentials</legend>
        <div className="field-group">
          <label htmlFor="student-number" className={LABEL}>
            Student ID Number
          </label>
          <input
            id="student-number"
            name="studentNumber"
            placeholder="202X-XXXX-MN-0"
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck={false}
            required
            className={INPUT}
            aria-invalid={isInvalid("studentNumber") || Boolean(idError)}
            aria-describedby={idError ? "student-number-error" : undefined}
          />
          {/* Only the API's malformed-ID answer stays inline; empty fields use the single line above the button. */}
          {idError && (
            <p id="student-number-error" className="field-error">
              {idError}
            </p>
          )}
        </div>
        <fieldset className="birth-date field-group">
          <legend className={LABEL}>Date of Birth</legend>
          <div className="date-fields max-lg:grid-cols-3! max-lg:gap-2!">
            <select
              name="birthMonth"
              aria-label="Birth month"
              autoComplete="bday-month"
              defaultValue=""
              required
              className={SELECT}
              aria-invalid={isInvalid("birthMonth")}
            >
              <option value="" disabled>
                Month
              </option>
              {MONTHS.map((month, i) => (
                <option key={month} value={i + 1}>
                  {month}
                </option>
              ))}
            </select>
            <select
              name="birthDay"
              aria-label="Birth day"
              autoComplete="bday-day"
              defaultValue=""
              required
              className={SELECT}
              aria-invalid={isInvalid("birthDay")}
            >
              <option value="" disabled>
                Day
              </option>
              {DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
            <select
              name="birthYear"
              aria-label="Birth year"
              autoComplete="bday-year"
              defaultValue=""
              required
              className={SELECT}
              aria-invalid={isInvalid("birthYear")}
            >
              <option value="" disabled>
                Year
              </option>
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
        <div className="field-group password-group mb-0!">
          <label htmlFor="password" className={LABEL}>
            Password
          </label>
          <div className="password-input">
            <input
              id="password"
              name="password"
              type={visible ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              required
              className={INPUT}
              aria-invalid={isInvalid("password")}
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
          {/* Inside the group so it sits snug under the input whatever the form gap is. */}
          <Link
            to="/forgot-password"
            className="forgot-password mt-0! min-h-8! px-0! text-xs! font-semibold! text-[#a6192e]! [text-shadow:0_1px_3px_rgb(255_255_255/0.4)] hover:underline"
          >
            Forgot Password?
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          {banner}
          <div className="flex flex-col gap-1">
            {/* Always one line tall, so showing the message never moves anything. */}
            <div aria-live="assertive" className="flex h-6 items-center justify-center">
              {message && (
                <span className="rounded-full border border-red-500/40 bg-red-950/40 px-3 text-xs leading-5 font-medium text-red-200">
                  {message}
                </span>
              )}
            </div>
            <button
              type="submit"
              className="primary-button h-[52px]! min-h-[52px]! text-sm! font-semibold! text-white!"
            >
              Sign in to Portal
            </button>
          </div>
        </div>
      </fieldset>
    </form>
  );
}
