import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A dialog over the page: a title, a Close button, and a body that scrolls on its own, so it
 * fits a 320px screen without the page behind it moving. Focus moves in, stays in (Tab wraps),
 * and goes back to what opened it on close; Escape closes it.
 *
 * There is no click-on-backdrop to close: Escape and Close already dismiss it, and a click
 * handler on a decorative backdrop would need its own keyboard equivalent (WCAG 2.1.1).
 */
export function Modal({ title, onClose, children }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // A ref, so a new `onClose` each render does not re-run the effect and steal focus back.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, []);

  return createPortal(
    <div className="bg-brand-ink/40 fixed inset-0 z-50 grid place-items-center p-3 sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90dvh] w-full max-w-lg min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="border-brand-border/20 flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-6">
          <h2 id={titleId} className="text-brand-maroon min-w-0 text-lg font-bold break-words">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="text-brand-ink hover:bg-brand-cream -mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-full"
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Close</span>
          </button>
        </div>
        <div className="min-w-0 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
