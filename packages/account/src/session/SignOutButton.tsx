import { ErrorAlert, SubmitButton } from "@cbpupsis/ui";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

import "../layout/auth.css";
import { useSignOut } from "./useSignOut";

/**
 * A Sign out button that asks first. The trigger is styled by the portal (`className`, and its
 * own content, such as an icon with a hidden label); the confirmation is the same modal as the
 * idle warning, so the two feel like one system.
 *
 * Only for a person's own request to sign out. The idle sign-out is automatic, and the idle
 * warning is already a confirmation, so both sign out directly.
 */
export function SignOutButton({
  className,
  children = "Sign out",
}: {
  className?: string;
  /** The trigger's content. Its accessible name must stay "Sign out". */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const signOut = useSignOut();

  function close() {
    if (signOut.isPending) return;
    signOut.reset();
    setOpen(false);
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={className}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <ConfirmSignOutDialog
            signingOut={signOut.isPending}
            error={signOut.error}
            returnFocus={trigger}
            onConfirm={() => signOut.mutate()}
            onCancel={close}
          />,
          document.body,
        )}
    </>
  );
}

/**
 * Hide everything but the dialog from assistive technology and the keyboard while it is open,
 * then put back what each element had before.
 */
function useInertBackground(dialogRoot: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = dialogRoot.current;
    const portal = root?.parentElement === document.body ? root : null;
    const changed: HTMLElement[] = [];
    for (const element of document.body.children) {
      if (!(element instanceof HTMLElement) || element === portal) continue;
      if (element.hasAttribute("inert")) continue;
      element.setAttribute("inert", "");
      changed.push(element);
    }
    return () => changed.forEach((element) => element.removeAttribute("inert"));
  }, [dialogRoot]);
}

function ConfirmSignOutDialog({
  signingOut,
  error,
  returnFocus,
  onConfirm,
  onCancel,
}: {
  signingOut: boolean;
  error: unknown;
  returnFocus: RefObject<HTMLButtonElement | null>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const backdrop = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useInertBackground(backdrop);

  // Cancel is the safe default; focus goes back to the trigger when the dialog closes.
  useEffect(() => {
    cancel.current?.focus();
    const previous = returnFocus;
    return () => {
      const target = previous.current;
      if (target?.isConnected) target.focus();
    };
  }, [returnFocus]);

  // Escape cancels; Tab and Shift+Tab wrap inside the dialog.
  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      const node = dialog.current;
      if (event.key !== "Tab" || !node) return;
      const focusable = [...node.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]")];
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
  }, [onCancel]);

  return (
    <div
      ref={backdrop}
      className="idle-backdrop"
      // Decoration only; Escape is the keyboard way to cancel.
      role="presentation"
      // A press on the backdrop itself, not on the dialog, cancels.
      onMouseDown={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div
        ref={dialog}
        className="idle-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sign-out-title"
        aria-describedby="sign-out-description"
      >
        <h2 id="sign-out-title">Sign out?</h2>
        <p id="sign-out-description">You will need to sign in again to use the portal.</p>
        {error !== null && error !== undefined && <ErrorAlert error={error} placement="inline" />}
        <div className="idle-actions">
          <SubmitButton type="button" busy={signingOut} onClick={onConfirm}>
            Sign out
          </SubmitButton>
          <button
            ref={cancel}
            type="button"
            className="secondary-button"
            disabled={signingOut}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
