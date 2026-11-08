import type { EnrollmentSection } from "@cbpupsis/shared/enrollment";

import { formatTimeRange } from "../../lib/datetime";
import { WEEKDAYS } from "./enrollmentDisplay";

interface EnlistedCoursesProps {
  sections: EnrollmentSection[];
  totalUnits: number;
  /** The student's real unit ceiling, for the live running-total feedback below (AC-ENRL-001.1,
   * .2, .6, .7): this is the page's only home for it now that Your Unit Limit is gone. */
  effectiveCeiling: number;
  summerSubjectCap: number | null;
  onClearAll: () => void;
  onRemove: (sectionId: string) => void;
}

function RemoveIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** The student's picked sections, below the table, with the running total against their real
 * unit ceiling, announced live as checkboxes toggle (AC-ENRL-001.1, .2, .6, .7, .8). */
export function EnlistedCourses({
  sections,
  totalUnits,
  effectiveCeiling,
  summerSubjectCap,
  onClearAll,
  onRemove,
}: EnlistedCoursesProps) {
  const overLimit = totalUnits > effectiveCeiling;
  const overSummerCap = summerSubjectCap !== null && sections.length > summerSubjectCap;
  const unitsOver = Math.round((totalUnits - effectiveCeiling) * 10) / 10;

  return (
    <section aria-labelledby="enlisted-courses-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="enlisted-courses-heading" className="text-xl font-bold text-neutral-900">
          Enlisted Courses
        </h2>
        {sections.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="hover:text-brand-crimson min-h-11 text-sm font-semibold text-neutral-500 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {summerSubjectCap !== null && (
        <p className="text-sm text-neutral-500">Summer limit: {summerSubjectCap} subjects</p>
      )}

      <div
        role="status"
        aria-live="polite"
        aria-label="Running total"
        className={`rounded-xl border px-4 py-3 text-sm ${
          overLimit
            ? "border-amber-700/30 bg-amber-100 text-amber-900"
            : "border-neutral-200 bg-neutral-50 text-neutral-900"
        }`}
      >
        <p className="font-bold">
          Running Total: <span className="tabular-nums">{totalUnits}</span> unit
          {totalUnits === 1 ? "" : "s"} of <span className="tabular-nums">{effectiveCeiling}</span>{" "}
          allowed
        </p>
        {overLimit && (
          <p className="mt-1">
            That is {unitsOver} unit{unitsOver === 1 ? "" : "s"} over your limit of{" "}
            {effectiveCeiling}. You can still submit: the system makes the final call.
          </p>
        )}
        {overSummerCap && (
          <p className="mt-1">
            You have picked {sections.length} subjects, over the summer limit of {summerSubjectCap}.
          </p>
        )}
      </div>

      {sections.length === 0 ? (
        <p className="rounded-2xl border border-neutral-200 bg-white p-6 text-center text-sm text-neutral-400">
          No Selected Course
        </p>
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <ul className="divide-y divide-neutral-100 text-sm">
            {sections.map((section) => (
              <li key={section.sectionId} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-900">{section.courseCode}</p>
                  <p className="text-xs text-neutral-500">{section.title}</p>
                  <ul className="mt-0.5 text-xs text-neutral-500">
                    {section.schedule.map((meeting) => (
                      <li key={`${meeting.dayOfWeek}-${meeting.startTime}`}>
                        {WEEKDAYS[meeting.dayOfWeek] ?? ""}{" "}
                        {formatTimeRange(meeting.startTime, meeting.endTime)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-neutral-900 tabular-nums">{section.units.toFixed(1)}u</span>
                  <button
                    type="button"
                    onClick={() => onRemove(section.sectionId)}
                    aria-label={`Remove ${section.courseCode} from your enlisted courses`}
                    className="hover:text-brand-crimson flex min-h-11 min-w-11 items-center justify-center text-neutral-400 transition-colors"
                  >
                    <RemoveIcon />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
