import type { MouseEvent, ReactNode } from "react";

/**
 * A button that shows its own busy state without changing size: the label stays in place
 * (transparent, still the accessible name) under a spinner.
 *
 * Busy is aria-disabled rather than disabled, so keyboard focus stays on the button while the
 * request runs; the click (and so the form submit) is swallowed instead.
 */
export function SubmitButton({
  busy = false,
  blocked = false,
  type = "submit",
  className = "primary-button",
  onClick,
  children,
}: {
  busy?: boolean;
  /** Not available for another reason, such as a waiting period. */
  blocked?: boolean;
  type?: "submit" | "button";
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const inactive = busy || blocked;
  function click(event: MouseEvent<HTMLButtonElement>) {
    if (inactive) {
      event.preventDefault();
      return;
    }
    onClick?.();
  }
  return (
    <button
      type={type}
      className={busy ? `${className} is-busy` : className}
      aria-disabled={inactive || undefined}
      onClick={click}
    >
      <span className="button-label">{children}</span>
      {busy && <span className="button-spinner" aria-hidden="true" />}
    </button>
  );
}
