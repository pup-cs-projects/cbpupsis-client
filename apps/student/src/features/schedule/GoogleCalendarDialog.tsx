import { useEffect, useRef, type ReactNode } from "react";

/**
 * Google Calendar as a pop-up: it stays off the page until the student asks for it. A native
 * modal <dialog>, so the browser traps focus and Escape closes it; a click on the backdrop
 * closes it too, and focus goes back to whatever opened it.
 */
export function GoogleCalendarDialog({
  busy,
  onClose,
  children,
}: {
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    close.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    // Backdrop click is a pointer-only convenience: Escape and the × button are the keyboard paths.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- see above
    <dialog
      ref={dialog}
      aria-labelledby="google-calendar-heading"
      onCancel={(event) => {
        // React bubbles `cancel` up the component tree, so Escape in the Disconnect
        // confirmation inside this pop-up would also arrive here. Only our own closes us.
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        if (!busy) onClose();
      }}
      // The dialog fills the backdrop's click target; its content sits in the padded child.
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      className="text-brand-ink backdrop:bg-brand-ink/50 fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-x-hidden overflow-y-auto rounded-2xl border-0 bg-white p-0 shadow-2xl print:hidden"
    >
      <div className="min-w-0 p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="google-calendar-heading" className="text-brand-ink text-lg font-bold">
            Google Calendar
          </h2>
          <button
            ref={close}
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
            className="text-brand-ink hover:bg-brand-paper -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
          >
            <svg
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.25}
              strokeLinecap="round"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
