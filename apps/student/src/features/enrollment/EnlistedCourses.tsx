import type { EnrollmentSection } from "@cbpupsis/shared/enrollment";

import { formatTimeRange } from "../../lib/datetime";
import { WEEKDAYS } from "./enrollmentDisplay";

interface EnlistedCoursesProps {
  sections: EnrollmentSection[];
  totalUnits: number;
  onClearAll: () => void;
  onRemove: (sectionId: string) => void;
}

/** The student's picked sections, below the table, with the running total (AC-ENRL-001.1). */
export function EnlistedCourses({
  sections,
  totalUnits,
  onClearAll,
  onRemove,
}: EnlistedCoursesProps) {
  return (
    <section
      aria-labelledby="enlisted-courses-heading"
      className="border-brand-border/25 rounded-2xl border bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="enlisted-courses-heading" className="text-brand-ink text-base font-bold">
          Enlisted Courses
        </h2>
        {sections.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-brand-crimson min-h-11 text-sm font-semibold hover:underline"
          >
            Clear All
          </button>
        )}
      </div>

      {sections.length === 0 ? (
        <p className="text-brand-muted mt-4 text-sm">No Selected Course</p>
      ) : (
        <>
          <ul className="divide-brand-border/20 mt-4 divide-y text-sm">
            {sections.map((section) => (
              <li key={section.sectionId} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-brand-ink font-semibold">{section.courseCode}</p>
                  <p className="text-brand-muted text-xs">{section.title}</p>
                  <ul className="text-brand-muted mt-0.5 text-xs">
                    {section.schedule.map((meeting) => (
                      <li key={`${meeting.dayOfWeek}-${meeting.startTime}`}>
                        {WEEKDAYS[meeting.dayOfWeek] ?? ""}{" "}
                        {formatTimeRange(meeting.startTime, meeting.endTime)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-brand-ink tabular-nums">{section.units.toFixed(1)}u</span>
                  <button
                    type="button"
                    onClick={() => onRemove(section.sectionId)}
                    aria-label={`Remove ${section.courseCode} from your enlisted courses`}
                    className="text-brand-crimson min-h-11 text-xs font-semibold hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="border-brand-border/20 text-brand-ink mt-4 border-t pt-3 text-sm font-bold">
            Total: <span className="tabular-nums">{totalUnits}</span> units
          </p>
        </>
      )}
    </section>
  );
}
