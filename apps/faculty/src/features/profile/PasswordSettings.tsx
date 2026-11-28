import { ApiError, errorMessage } from "@cbpupsis/shared/api";
import { changePassword, checkPassword, meetsPolicy } from "@cbpupsis/shared/auth";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { passwordApi, session } from "../../lib/auth";
import { gradeButton, gradeCard, gradeField, gradePrimary } from "../grades/gradeStyles";

export function PasswordSettings() {
  const policy = useQuery({
    queryKey: ["faculty-password-policy"],
    queryFn: ({ signal }) => passwordApi.policy(signal),
    retry: false,
  });
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [currentError, setCurrentError] = useState(false);
  const [waitUntil, setWaitUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const running = useRef(false);
  useEffect(() => {
    if (!waitUntil) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [waitUntil]);
  const checks = policy.data ? checkPassword(policy.data, password, { current }) : [];
  const mismatch = confirm.length > 0 && password !== confirm;
  const wait = Math.max(0, Math.ceil((waitUntil - now) / 1000));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (
      running.current ||
      !policy.data ||
      !current ||
      !confirm ||
      mismatch ||
      !meetsPolicy(checks) ||
      wait
    )
      return;
    running.current = true;
    setBusy(true);
    setNotice(null);
    setFailure(null);
    setCurrentError(false);
    try {
      await changePassword(session, passwordApi, {
        currentPassword: current,
        newPassword: password,
      });
      setCurrent("");
      setPassword("");
      setConfirm("");
      setNotice("Password changed. Other devices are signed out.");
    } catch (error) {
      if (
        error instanceof ApiError &&
        ["AUTH_CURRENT_PASSWORD_INCORRECT", "CURRENT_PASSWORD_INCORRECT"].includes(error.code ?? "")
      ) {
        setCurrentError(true);
        setFailure("Your current password is incorrect.");
      } else if (error instanceof ApiError && error.code === "AUTH_PASSWORD_TOO_WEAK") {
        const unmet = error.details?.unmet_rules;
        setFailure(
          Array.isArray(unmet)
            ? `Password does not meet these rules: ${unmet.filter((r) => typeof r === "string").join(", ")}.`
            : errorMessage(error),
        );
      } else if (error instanceof ApiError && error.status === 423) {
        setWaitUntil(error.retryAt ?? 0);
        setNow(() => Date.now());
        setFailure("Your account is temporarily locked.");
      } else setFailure(errorMessage(error));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <section id="password" className={gradeCard} aria-labelledby="password-heading">
      <h2 id="password-heading" className="text-xl font-bold">
        Change password
      </h2>
      {policy.isPending ? (
        <p role="status" className="mt-4">
          Loading password rules…
        </p>
      ) : policy.error ? (
        <div role="alert" className="mt-4">
          <p>{errorMessage(policy.error)}</p>
          <button className={gradeButton + " mt-3"} onClick={() => void policy.refetch()}>
            Retry password rules
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-4" noValidate>
          <label className="block text-sm font-medium">
            Current password
            <input
              className={gradeField + " mt-2"}
              type="password"
              autoComplete="current-password"
              value={current}
              disabled={busy}
              onChange={(e) => {
                setCurrent(e.target.value);
                setCurrentError(false);
              }}
              aria-invalid={currentError}
              aria-describedby={currentError ? "password-error" : undefined}
            />
          </label>
          <label className="block text-sm font-medium">
            New password
            <input
              className={gradeField + " mt-2"}
              type="password"
              autoComplete="new-password"
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="password-rules"
            />
          </label>
          <ul id="password-rules" className="space-y-1 text-sm">
            {checks.map((check) => (
              <li key={check.rule} className={check.met ? "text-brand-maroon" : "text-brand-muted"}>
                <span className="mr-2" aria-hidden="true">
                  {check.met ? "✓" : "○"}
                </span>
                {check.label}
                <span className="sr-only">{check.met ? " — met" : " — not met"}</span>
              </li>
            ))}
          </ul>
          <label className="block text-sm font-medium">
            Confirm new password
            <input
              className={gradeField + " mt-2"}
              type="password"
              autoComplete="new-password"
              value={confirm}
              disabled={busy}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={mismatch}
              aria-describedby={mismatch ? "password-mismatch" : undefined}
            />
          </label>
          {mismatch && (
            <p id="password-mismatch" role="alert" className="text-sm text-red-700">
              The passwords do not match.
            </p>
          )}
          {failure && (
            <p id="password-error" role="alert" className="text-sm text-red-700">
              {failure}
              {wait > 0 ? ` Try again in ${wait} seconds.` : ""}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm">
              {notice}
            </p>
          )}
          <button
            className={gradePrimary + " w-full"}
            disabled={busy || !!wait || !current || !confirm || mismatch || !meetsPolicy(checks)}
          >
            {busy ? "Changing password…" : "Change password"}
          </button>
        </form>
      )}
    </section>
  );
}
