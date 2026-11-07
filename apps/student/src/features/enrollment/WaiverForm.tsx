import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import type { BlockedSection, WaiverCondition } from "@cbpupsis/shared/enrollment";

import { refusalMessage } from "./blocking";
import { useFileWaiver } from "./useWaiver";

const CONDITIONS: { value: WaiverCondition; label: string }[] = [
  { value: "REPEATED_PREREQUISITE", label: "I am repeating the prerequisite subject" },
  { value: "SUPERIOR_STANDING", label: "My GWA is 1.75 or better" },
  { value: "GRADUATING", label: "I am graduating this term" },
];

const primary =
  "bg-brand-maroon hover:bg-brand-maroon-dark inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-semibold text-white disabled:opacity-60";
const toggle =
  "border-brand-maroon text-brand-maroon inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold";
const input =
  "border-brand-border/40 focus:border-brand-maroon w-full rounded-lg border px-3 py-2 text-sm";

/**
 * "Request a waiver" for a section whose `waiverAvailable` is true (AC-ENRL-002.9). It files
 * one waiver for one unmet prerequisite; `onFiled` lets the page refresh its course list.
 */
export function WaiverForm({
  section,
  onFiled,
}: {
  section: BlockedSection;
  onFiled?: () => void;
}) {
  const id = useId();
  const prerequisites = (section.blocks ?? [])
    .filter((block) => block.rule === "ENROLL_PREREQUISITE_NOT_MET")
    .map((block) => block.courseCode);
  const [open, setOpen] = useState(false);
  const [prerequisite, setPrerequisite] = useState(prerequisites[0] ?? "");
  const [condition, setCondition] = useState<WaiverCondition | "">("");
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const filing = useFileWaiver();
  // Keyboard users land on the form when it opens and back on the button when it closes.
  const heading = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);
  useEffect(() => {
    if (open) heading.current?.focus();
    else if (opened.current) opener.current?.focus();
    opened.current ||= open;
  }, [open]);

  if (!section.waiverAvailable || prerequisites.length === 0) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (filing.isPending) return;
    if (!condition) return setProblem("Choose the condition that applies to you.");
    if (!reason.trim()) return setProblem("Write your reason for the waiver.");
    setProblem(null);
    filing.mutate(
      {
        sectionId: section.sectionId,
        prerequisiteCourseCode: prerequisite,
        condition,
        justification: reason.trim(),
      },
      {
        onSuccess: () => {
          setOpen(false);
          onFiled?.();
        },
      },
    );
  }

  if (!open) {
    return (
      <div className="space-y-2">
        {filing.isSuccess && (
          <p role="status" className="text-brand-ink text-sm">
            Waiver filed. It is now with the Chair.
          </p>
        )}
        {!filing.isSuccess && (
          <button type="button" ref={opener} className={toggle} onClick={() => setOpen(true)}>
            Request a waiver for {section.courseCode}
          </button>
        )}
      </div>
    );
  }

  const message = problem ?? (filing.isError ? refusalMessage(filing.error, section.blocks) : null);

  return (
    <form noValidate onSubmit={submit} aria-labelledby={`${id}-title`} className="space-y-3">
      <h4
        id={`${id}-title`}
        ref={heading}
        tabIndex={-1}
        className="text-brand-ink text-base font-bold"
      >
        Request a waiver for {section.courseCode}
      </h4>
      {prerequisites.length > 1 && (
        <div className="space-y-1">
          <label htmlFor={`${id}-prerequisite`} className="block text-sm font-semibold">
            Prerequisite to waive
          </label>
          <select
            id={`${id}-prerequisite`}
            className={input}
            value={prerequisite}
            onChange={(event) => setPrerequisite(event.target.value)}
          >
            {prerequisites.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">
          Which condition applies to you{prerequisites.length === 1 && ` (for ${prerequisite})`}?
        </legend>
        {CONDITIONS.map((option) => (
          <label key={option.value} className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${id}-condition`}
              value={option.value}
              checked={condition === option.value}
              onChange={() => setCondition(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <div className="space-y-1">
        <label htmlFor={`${id}-reason`} className="block text-sm font-semibold">
          Reason
        </label>
        <textarea
          id={`${id}-reason`}
          className={input}
          rows={4}
          maxLength={4000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
      {message && (
        <p role="alert" className="text-brand-ink text-sm">
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={primary} disabled={filing.isPending}>
          {filing.isPending ? "Sending..." : "Send waiver request"}
        </button>
        <button type="button" className={toggle} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
