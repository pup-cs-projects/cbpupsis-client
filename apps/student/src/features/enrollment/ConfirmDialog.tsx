import type { EnrollmentSection } from "@cbpupsis/shared/enrollment";
import { useEffect, useRef } from "react";

import { formatTimeRange } from "../../lib/datetime";
import { WEEKDAYS } from "./enrollmentDisplay";

interface ConfirmDialogProps {
  sections: EnrollmentSection[];
  totalUnits: number;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The confirm step: the chosen sections, their schedules, and the total, before `submit` is
 * ever called. Confirm is disabled while the mutation is in flight (AC-ENRL-001.1, .12).
 */
export function ConfirmDialog({
  sections,
  totalUnits,
  pending,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    // No backdrop click-to-close: Escape and the Cancel button already dismiss it, and a click
    // handler on this decorative backdrop would need its own keyboard equivalent (WCAG 2.1.1).
    <div className="bg-brand-ink/40 fixed inset-0 z-50 grid place-items-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-enrollment-heading"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 id="confirm-enrollment-heading" className="text-brand-maroon text-xl font-bold">
          Confirm Your Enrollment
        </h2>
        <p className="text-brand-muted mt-1 text-sm">
          Review your selected sections before you submit. This can only be sent once.
        </p>

        <ul className="divide-brand-border/20 mt-4 divide-y text-sm">
          {sections.map((section) => (
            <li key={section.sectionId} className="py-2.5">
              <p className="text-brand-ink font-semibold">
                {section.courseCode}: {section.title}
              </p>
              <ul className="text-brand-muted mt-0.5 text-xs">
                {section.schedule.map((meeting) => (
                  <li key={`${meeting.dayOfWeek}-${meeting.startTime}`}>
                    {WEEKDAYS[meeting.dayOfWeek] ?? ""}{" "}
                    {formatTimeRange(meeting.startTime, meeting.endTime)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <p className="border-brand-border/20 text-brand-ink mt-4 border-t pt-3 text-sm font-bold">
          Total: <span className="tabular-nums">{totalUnits}</span> units
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="border-brand-border/40 text-brand-ink min-h-11 rounded-xl border px-5 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="bg-brand-crimson hover:bg-brand-crimson-dark min-h-11 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Submitting…" : "Confirm & Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
