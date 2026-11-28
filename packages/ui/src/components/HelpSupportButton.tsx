import { useState, type ReactNode } from "react";

import { ModalDialog } from "./ModalDialog";

export const SUPPORT_EMAIL = "icto-admin@pup.edu.ph";

/**
 * Help & Support in the sidebar. A bare mailto link does nothing on a computer without a mail
 * app, so this opens a dialog with the support address, a copy button, and the mail link.
 */
export function HelpSupportButton({
  className,
  children,
  label = "Help & Support",
}: {
  className: string;
  children: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        className={`${className} cursor-pointer`}
        onClick={() => {
          setCopied(false);
          setOpen(true);
        }}
      >
        {children}
      </button>
      <ModalDialog open={open} title="Help & Support" onClose={() => setOpen(false)}>
        <p className="mt-3 text-sm text-neutral-700">
          For account, enrollment, or portal concerns, email the PUP ICTO support team. Include your
          name, your student or employee number, and a short description of the problem.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <span className="text-sm font-semibold break-all text-neutral-900">{SUPPORT_EMAIL}</span>
          <button
            type="button"
            className="text-brand-maroon ml-auto cursor-pointer rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-100"
            onClick={() => void copy()}
          >
            {copied ? "Copied" : "Copy email"}
          </button>
        </div>
        <p className="sr-only" aria-live="polite">
          {copied ? "Email address copied" : ""}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            data-initial-focus
            className="min-h-11 cursor-pointer rounded-xl border border-neutral-300 bg-white px-5 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="bg-brand-maroon hover:bg-brand-maroon-dark inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold text-white"
          >
            Open email app
          </a>
        </div>
      </ModalDialog>
    </>
  );
}
