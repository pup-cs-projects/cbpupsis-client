import { useState, type InputHTMLAttributes, type Ref } from "react";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type" | "required">;

interface FieldProps extends InputProps {
  id: string;
  label: string;
  /** Shown under the field; the space is kept so an error never moves the form. */
  error?: string;
  hint?: string;
  /** Ids of other elements that describe the field, such as a password checklist. */
  describedBy?: string;
  inputRef?: Ref<HTMLInputElement>;
}

function describedBy(...ids: (string | false | undefined)[]) {
  return ids.filter(Boolean).join(" ") || undefined;
}

/** A required text input with its visible label, optional hint, and reserved error line. */
export function TextField({
  id,
  label,
  error,
  hint,
  describedBy: extra,
  inputRef,
  type = "text",
  ...input
}: FieldProps & { type?: "text" | "email" }) {
  return (
    <div className="field-group">
      <label htmlFor={id}>
        {label} <span className="required">*</span>
      </label>
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      <input
        {...input}
        id={id}
        ref={inputRef}
        type={type}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(error && `${id}-error`, hint && `${id}-hint`, extra)}
      />
      <p id={`${id}-error`} className="field-message">
        {error}
      </p>
    </div>
  );
}

/** A required password input with a show toggle in place of a second, confirming field. */
export function PasswordField({
  id,
  label,
  error,
  hint,
  describedBy: extra,
  inputRef,
  ...input
}: FieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field-group">
      <label htmlFor={id}>
        {label} <span className="required">*</span>
      </label>
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      <div className="password-input">
        <input
          {...input}
          id={id}
          ref={inputRef}
          type={visible ? "text" : "password"}
          required
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(error && `${id}-error`, hint && `${id}-hint`, extra)}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible(!visible)}
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
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
      <p id={`${id}-error`} className="field-message">
        {error}
      </p>
    </div>
  );
}
