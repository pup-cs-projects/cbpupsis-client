import { ApiError } from "@cbpupsis/shared/api";
import { changePassword, checkPassword, meetsPolicy } from "@cbpupsis/shared/auth";
import { ErrorAlert, Notice, PasswordChecklist } from "@cbpupsis/ui";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useRef, useState, type FormEvent, type Ref } from "react";
import { flushSync } from "react-dom";

import "@cbpupsis/account/styles.css";

import { passwordApi, session } from "../../lib/auth";

// The API's only rule beyond length is that the new password differs from the current one, and
// it answers that itself; the checklist shows the length so the form can say so before sending.
const POLICY = { minimumLength: 12, rules: [] } as const;

function PasswordInput({
  id,
  label,
  hint,
  error,
  value,
  autoComplete,
  describedBy,
  inputRef,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  value: string;
  autoComplete: "current-password" | "new-password";
  describedBy?: string;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const described =
    [error && errorId, hint && hintId, describedBy].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-brand-ink text-sm font-semibold">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-brand-muted text-xs">
          {hint}
        </p>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          spellCheck={false}
          autoCapitalize="none"
          aria-invalid={Boolean(error)}
          aria-describedby={described}
          onChange={(event) => onChange(event.target.value)}
          className={[
            "text-brand-ink w-full rounded-xl border bg-white py-3 pr-12 pl-4 text-sm transition-colors",
            "focus-visible:ring-brand-maroon focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
            error ? "border-red-500 focus-visible:ring-red-600" : "border-brand-border/60",
          ].join(" ")}
        />
        <button
          type="button"
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="text-brand-muted hover:text-brand-maroon focus-visible:outline-brand-maroon absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl"
          onClick={() => setVisible((value) => !value)}
        >
          <svg
            className="size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {!visible && <path d="m3 21 18-18" />}
          </svg>
        </button>
      </div>
      {/* Reserved line so errors never shift layout */}
      <p
        id={errorId}
        role={error ? "alert" : undefined}
        className="min-h-[1.1rem] text-xs text-red-600"
      >
        {error}
      </p>
    </div>
  );
}

/**
 * Change the signed-in student's own password. The session carries on with the new pair the API
 * returns, so nothing here signs the student out.
 */
export function ChangePasswordSection() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [checked, setChecked] = useState(false);
  // Each success increments this so the confirmation remounts and shows again.
  const [savedKey, setSavedKey] = useState(0);
  const currentInput = useRef<HTMLInputElement>(null);
  const newInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const navigate = useNavigate();

  // Leave without changing anything: back to the page the student came from, else the dashboard.
  function cancel() {
    setCurrent("");
    setPassword("");
    setChecked(false);
    if (window.history.length > 1) router.history.back();
    else void navigate({ to: "/dashboard" });
  }

  // Passwords must not linger in the mutation cache.
  const change = useMutation({
    gcTime: 0,
    retry: false,
    mutationFn: (passwords: { currentPassword: string; newPassword: string }) =>
      changePassword(session, passwordApi, passwords),
  });

  const checks = checkPassword(POLICY, password);
  const ready = meetsPolicy(checks);
  const currentError = checked && !current ? "Enter your current password." : undefined;
  const newError =
    checked && !ready
      ? password
        ? "Your new password does not meet every rule yet."
        : "Enter a new password."
      : password && password === current
        ? "Choose a password different from your current one."
        : undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (change.isPending) return;
    setChecked(true);
    if (!current || !ready || password === current) {
      (!current ? currentInput : newInput).current?.focus();
      return;
    }
    change.mutate(
      { currentPassword: current, newPassword: password },
      {
        onSuccess: () => {
          setCurrent("");
          setPassword("");
          setChecked(false);
          setSavedKey((key) => key + 1);
        },
        onError: (error) => {
          // Keep nothing of a refused password; flushed first so moving focus below does not
          // re-check a field that still shows the old text.
          flushSync(() => {
            setCurrent("");
            setPassword("");
            setChecked(false);
          });
          if (!(error instanceof ApiError)) return;
          if (error.code === "CURRENT_PASSWORD_INCORRECT") currentInput.current?.focus();
          if (error.code === "AUTH_PASSWORD_TOO_WEAK") newInput.current?.focus();
        },
      },
    );
  }

  return (
    <section
      aria-labelledby="change-password-heading"
      className="border-brand-border/30 rounded-2xl border bg-white p-5 shadow-sm sm:p-6"
    >
      {savedKey > 0 && (
        <Notice key={savedKey} tone="success">
          Your password was changed.
        </Notice>
      )}

      <h2 id="change-password-heading" className="text-brand-ink text-xl font-bold tracking-tight">
        Change Password
      </h2>
      <p className="text-brand-muted mt-1 max-w-2xl text-sm leading-relaxed">
        Choose a new password for your student account. You stay signed in on this device.
      </p>

      <form className="mt-6 max-w-md space-y-2" onSubmit={submit} noValidate>
        <PasswordInput
          id="settings-current-password"
          label="Current password"
          autoComplete="current-password"
          value={current}
          error={currentError}
          inputRef={currentInput}
          onChange={setCurrent}
        />
        <PasswordInput
          id="settings-new-password"
          label="New password"
          autoComplete="new-password"
          value={password}
          error={newError}
          describedBy="settings-new-password-rules"
          inputRef={newInput}
          onChange={setPassword}
        />
        <PasswordChecklist id="settings-new-password-rules" checks={checks} />

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={cancel}
            className="border-brand-border/60 text-brand-ink focus-visible:outline-brand-maroon min-h-11 rounded-xl border bg-white px-6 text-sm font-semibold transition-colors hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            aria-disabled={change.isPending || undefined}
            className="bg-brand-maroon hover:bg-brand-maroon-dark focus-visible:outline-brand-maroon min-h-11 rounded-xl px-6 text-sm font-semibold text-white transition-colors aria-disabled:cursor-wait aria-disabled:opacity-70"
          >
            {change.isPending ? "Changing password…" : "Change password"}
          </button>
        </div>

        {change.error && <ErrorAlert error={change.error} title="Your password was not changed" />}
      </form>
    </section>
  );
}
