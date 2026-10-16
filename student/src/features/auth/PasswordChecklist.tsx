import { meetsPolicy, type PasswordCheck } from "@cbpupsis/shared/auth";

/**
 * The password rules, ticking as the person types. Each rule shows its state by icon shape and
 * by text for screen readers, never by color alone; reaching every rule is announced once.
 */
export function PasswordChecklist({ id, checks }: { id: string; checks: PasswordCheck[] }) {
  const done = meetsPolicy(checks);
  return (
    <div id={id} className="password-rules">
      <p className="password-rules-title">Your password needs:</p>
      <ul>
        {checks.map((check) => (
          <li key={check.rule} data-met={check.met}>
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <circle cx="9" cy="9" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
              {check.met && (
                <path
                  d="m5 9.5 2.5 2.5L13 6.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
            <span>
              {check.label}
              <span className="sr-only">{check.met ? ": done" : ": not yet"}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-live="polite">
        {done ? "Your password meets every rule." : ""}
      </p>
    </div>
  );
}
