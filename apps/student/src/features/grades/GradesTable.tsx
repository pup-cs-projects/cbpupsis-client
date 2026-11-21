import type { GradeStatus, TermGrades } from "./gradesTypes";
import { termLabel } from "./useGrades";

const th = "px-4 py-3 text-left text-sm font-semibold whitespace-nowrap";
const td = "px-4 py-3.5 align-middle text-sm";

/** Each pill pairs its word with a tint; every pair is at least 4.5:1. */
const STATUS_PILL: Record<GradeStatus, string> = {
  Passed: "bg-green-100 text-green-800 border-green-700/30",
  Failed: "bg-red-100 text-red-800 border-red-700/30",
  Incomplete: "bg-amber-100 text-amber-900 border-amber-700/30",
  Dropped: "bg-neutral-200 text-neutral-800 border-neutral-500/30",
  "In Progress": "bg-sky-100 text-sky-900 border-sky-700/30",
};

export function StatusPill({ status }: { status: GradeStatus }) {
  return (
    <span
      className={`grades-pill inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_PILL[status]}`}
    >
      {status}
    </span>
  );
}

/** A graphic for "nothing here yet": an empty report card. Decorative. */
function EmptyIllustration() {
  return (
    <svg
      className="text-brand-crimson mx-auto h-28 w-auto"
      viewBox="0 0 120 100"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="22" y="10" width="64" height="82" rx="8" className="fill-brand-paper" />
      <rect x="22" y="10" width="64" height="82" rx="8" stroke="currentColor" strokeWidth="3" />
      <rect
        x="38"
        y="4"
        width="32"
        height="14"
        rx="4"
        fill="white"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        d="M34 36h40M34 50h40M34 64h24"
        stroke="currentColor"
        strokeOpacity=".35"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="86" cy="72" r="16" fill="white" stroke="currentColor" strokeWidth="3" />
      <path d="M86 64v9l5 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

interface GradesTableProps {
  term: TermGrades;
  /**
   * Show the term's title on screen. With one term the selector above already names it, so
   * the title stays for screen readers and paper only; the full transcript needs it per term.
   */
  showTitle?: boolean;
}

/** One term of the transcript: its grades, or why there are none. */
export function GradesTable({ term, showTitle = false }: GradesTableProps) {
  const title = termLabel(term);
  const headingId = `term-${term.termId}-heading`;

  return (
    <section aria-labelledby={headingId} className="grades-term">
      <h2
        id={headingId}
        className={
          showTitle
            ? "text-brand-ink mb-3 text-lg font-bold sm:text-xl"
            : "print:text-brand-ink sr-only print:not-sr-only print:mb-3 print:block print:text-lg print:font-bold"
        }
      >
        {title}
      </h2>

      {term.grades.length === 0 ? (
        <div
          role="status"
          className="border-brand-border/25 rounded-2xl border bg-white px-6 py-12 text-center shadow-sm"
        >
          <EmptyIllustration />
          <p className="text-brand-ink mt-5 text-base font-semibold">
            No grades posted yet for this academic term.
          </p>
          <p className="text-brand-muted mx-auto mt-1 max-w-md text-sm">
            Your final grades appear here as your instructors submit them and the registrar posts
            them.
          </p>
        </div>
      ) : (
        <div className="grades-card border-brand-border/25 overflow-hidden rounded-2xl border bg-white shadow-sm">
          {/* A keyboard user can focus the region to scroll it when the table is wider than it. */}
          <div
            role="region"
            aria-label={`Grades, ${title}`}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region (WCAG 2.1.1)
            tabIndex={0}
            className="grades-scroll overflow-x-auto"
          >
            <table className="grades-table w-full min-w-[720px] border-collapse">
              <caption className="sr-only">Final grades for {title}</caption>
              <thead className="bg-brand-crimson text-white">
                <tr>
                  <th scope="col" className={th}>
                    Course Code
                  </th>
                  <th scope="col" className={th}>
                    Course Title
                  </th>
                  <th scope="col" className={`${th} text-center`}>
                    Units
                  </th>
                  <th scope="col" className={`${th} text-center`}>
                    Final Grade
                  </th>
                  <th scope="col" className={th}>
                    Status
                  </th>
                  <th scope="col" className={th}>
                    Date Posted
                  </th>
                </tr>
              </thead>
              <tbody className="divide-brand-border/20 divide-y">
                {term.grades.map((grade) => (
                  <tr
                    key={grade.id}
                    className="even:bg-brand-paper hover:bg-brand-crimson/5 transition-colors"
                  >
                    <th
                      scope="row"
                      className={`${td} text-brand-crimson text-left font-bold whitespace-nowrap`}
                    >
                      {grade.courseCode}
                    </th>
                    <td className={`${td} text-brand-ink`}>{grade.courseTitle}</td>
                    <td className={`${td} text-brand-ink text-center tabular-nums`}>
                      {grade.units.toFixed(1)}
                    </td>
                    <td className={`${td} text-center tabular-nums`}>
                      {grade.finalGrade ? (
                        <span className="text-brand-ink font-bold">{grade.finalGrade}</span>
                      ) : (
                        <span className="text-brand-muted">Not posted</span>
                      )}
                    </td>
                    <td className={td}>
                      <StatusPill status={grade.status} />
                    </td>
                    <td className={`${td} text-brand-ink whitespace-nowrap tabular-nums`}>
                      {grade.datePosted ?? <span className="text-brand-muted">Not posted</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
