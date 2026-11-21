import { useEffect, useRef } from "react";

export function GoogleCalendarDisconnectDialog({
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    cancel.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="calendar-disconnect-title"
      aria-describedby="calendar-disconnect-description"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else onCancel();
      }}
      className="text-brand-ink backdrop:bg-brand-ink/50 fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border-0 bg-white p-6 shadow-2xl"
    >
      <h2 id="calendar-disconnect-title" className="text-brand-maroon text-xl font-bold">
        Disconnect Google Calendar?
      </h2>
      <p
        id="calendar-disconnect-description"
        className="text-brand-muted mt-3 text-sm leading-relaxed"
      >
        This stops future syncing. Your existing calendars and events stay in Google.
      </p>
      {error && (
        <p role="alert" className="text-brand-maroon mt-4 text-sm">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          ref={cancel}
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="border-brand-border/40 min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="bg-brand-maroon hover:bg-brand-maroon-dark min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Disconnecting…" : "Disconnect"}
        </button>
      </div>
    </dialog>
  );
}
