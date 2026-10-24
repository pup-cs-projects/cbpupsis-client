import { Notice } from "@cbpupsis/ui";
import { useId, useState, type ReactNode } from "react";

import type { CumulativeSummary, StandingStatus, TermGrades } from "./gradesTypes";

function Icon({ children, className = "size-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={`${className} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const StarIcon = () => (
  <Icon className="size-3.5">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
  </Icon>
);
const DocumentIcon = () => (
  <Icon>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6M8 13h8M8 17h5" />
  </Icon>
);

/** Pill tint per standing. The words carry the meaning; every pair is at least 4.5:1. */
const STANDING_PILL: Record<StandingStatus, string> = {
  "Good Standing": "bg-green-100 text-green-800 border-green-700/30",
  Probationary: "bg-amber-100 text-amber-900 border-amber-700/30",
  Warning: "bg-amber-100 text-amber-900 border-amber-700/30",
  Dismissed: "bg-red-100 text-red-800 border-red-700/30",
  "Pending Evaluation": "bg-neutral-100 text-neutral-700 border-neutral-500/30",
};

const card = "border-brand-border/25 rounded-2xl border bg-white p-5 shadow-sm";

function Metric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="grades-metric flex flex-col items-center px-3 py-1 text-center">
      <dt className="text-brand-muted text-xs font-semibold tracking-wide uppercase">{label}</dt>
      <dd className={`mt-1.5 text-4xl leading-none font-bold tabular-nums ${accent}`}>{value}</dd>
    </div>
  );
}

interface AcademicSummaryProps {
  summary: CumulativeSummary;
  /** The term the table shows (the newest graded one for the full transcript). */
  term: TermGrades | undefined;
}

const APPEAL_UNAVAILABLE =
  "Grade appeals are currently unavailable here. Please file through your department.";

/**
 * Term GPA beside the cumulative GWA, then units earned, standing, the GWA note, and the grade
 * appeal window.
 */
export function AcademicSummaryCard({ summary, term }: AcademicSummaryProps) {
  const standing = term?.standingStatus ?? "Pending Evaluation";
  const tooltipId = useId();
  // Counts presses, so the toast shows again on every click, even after it was dismissed.
  const [appealPresses, setAppealPresses] = useState(0);
  const appealText =
    term?.isAppealOpen && term.appealDeadlineDays !== null
      ? `Formal appeals for this term close in ${term.appealDeadlineDays} ${
          term.appealDeadlineDays === 1 ? "day" : "days"
        }.`
      : "The appeal window for this term is closed.";

  return (
    <section aria-labelledby="academic-summary-heading" className={`grades-panel ${card}`}>
      <h2 id="academic-summary-heading" className="text-brand-ink text-base font-bold">
        Academic Summary
      </h2>
      {term && (
        <p className="text-brand-muted mt-0.5 text-xs">
          {term.semester}, A.Y. {term.academicYear}
        </p>
      )}

      <dl className="divide-brand-border/25 border-brand-border/20 bg-brand-paper mt-4 grid grid-cols-2 divide-x rounded-xl border py-4">
        <Metric label="Term GPA" value={term?.gpa ?? "N/A"} accent="text-brand-crimson" />
        <Metric
          label="Cumulative GWA"
          value={summary.cumulativeGwa ?? "N/A"}
          accent="text-brand-ink"
        />
      </dl>

      <dl className="divide-brand-border/20 mt-4 divide-y text-sm">
        <div className="flex items-center justify-between gap-3 py-2.5">
          <dt className="text-brand-muted">Units Earned</dt>
          <dd className="text-brand-ink font-bold tabular-nums">{summary.totalUnitsEarned}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 py-2.5">
          <dt className="text-brand-muted">Status</dt>
          <dd>
            <span
              className={`grades-pill inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STANDING_PILL[standing]}`}
            >
              {standing === "Good Standing" && <StarIcon />}
              {standing}
            </span>
          </dd>
        </div>
      </dl>

      <p className="text-brand-muted border-brand-border/20 mt-2 border-t pt-4 text-xs leading-relaxed">
        {summary.exclusionNote}
      </p>

      <div className="mt-4 border-t border-neutral-200 pt-4 print:hidden">
        <p className="mb-2 text-xs text-neutral-500">{appealText}</p>

        {/* Appeals are out of scope for US-STU-004: unavailable, never dead. The button stays
            focusable so keyboard and screen reader users learn why, and a press says so too. */}
        <div className="group relative">
          <button
            type="button"
            aria-disabled="true"
            aria-describedby={tooltipId}
            onClick={() => setAppealPresses((n) => n + 1)}
            className="bg-brand-crimson hover:bg-brand-crimson-dark flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors"
          >
            <DocumentIcon />
            Initiate Grade Appeal
          </button>
          <span
            id={tooltipId}
            role="tooltip"
            className="bg-brand-ink pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-[16rem] -translate-x-1/2 rounded-lg px-3 py-2 text-center text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none"
          >
            {APPEAL_UNAVAILABLE}
          </span>
        </div>
      </div>

      {appealPresses > 0 && (
        <Notice key={appealPresses} tone="info">
          {APPEAL_UNAVAILABLE}
        </Notice>
      )}
    </section>
  );
}
