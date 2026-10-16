import { IDLE_TIMEOUT_MS, IDLE_WARNING_MS } from "@cbpupsis/shared/auth";
import { ErrorAlert, formatTime, SubmitButton, useCountdown } from "@cbpupsis/ui";
import { useEffect, useRef, type RefObject } from "react";

const IDLE_MINUTES = (IDLE_TIMEOUT_MS - IDLE_WARNING_MS) / 60_000;

/**
 * The five-minute warning before the idle sign-out (FR1). A modal: the page behind it is inert,
 * Tab stays inside, Escape counts as staying, and focus goes back where it was on close.
 */
export function IdleWarning({
  endsAt,
  staying,
  stayError,
  signingOut,
  returnFocus,
  onStay,
  onSignOut,
}: {
  endsAt: number;
  staying: boolean;
  stayError: unknown;
  signingOut: boolean;
  returnFocus: RefObject<Element | null>;
  onStay: () => void;
  onSignOut: () => void;
}) {
  const remaining = useCountdown(endsAt) ?? 0;
  const dialog = useRef<HTMLDivElement>(null);
  const stayButton = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stayButton.current?.querySelector("button")?.focus();
    const previous = returnFocus;
    return () => {
      const target = previous.current;
      if (target instanceof HTMLElement && target.isConnected) target.focus();
    };
  }, [returnFocus]);

  // Escape counts as staying; Tab and Shift+Tab wrap inside the dialog.
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    function keyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!staying) onStay();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const focusable = [...node.querySelectorAll<HTMLElement>("button, a[href]")];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", keyDown);
    return () => document.removeEventListener("keydown", keyDown);
  }, [staying, onStay]);

  return (
    <div className="idle-backdrop">
      <div
        ref={dialog}
        className="idle-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-title"
        aria-describedby="idle-description"
      >
        <h2 id="idle-title">Your session is about to end</h2>
        <p id="idle-description">
          There has been no activity for {IDLE_MINUTES} minutes. For your security, you will be
          signed out in{" "}
          <span className="idle-timer" role="timer" aria-label="Time left before sign-out">
            {formatTime(remaining)}
          </span>
          .
        </p>
        <p className="sr-only" aria-live="polite">
          {remaining > 0 && remaining <= 60 ? "Less than one minute left before sign-out." : ""}
        </p>
        {stayError !== null && stayError !== undefined && <ErrorAlert error={stayError} />}
        <div className="idle-actions" ref={stayButton}>
          <SubmitButton type="button" busy={staying} onClick={onStay}>
            Stay signed in
          </SubmitButton>
          <button
            type="button"
            className="secondary-button"
            disabled={signingOut}
            onClick={onSignOut}
          >
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}
