import type { EnrollmentSection } from "@cbpupsis/shared/enrollment";

import { formatTimeRange } from "../../lib/datetime";
import { WEEKDAYS } from "./enrollmentDisplay";

const th = "px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap uppercase";
const td = "px-4 py-4 align-top text-sm";

interface CourseTableProps {
  sections: EnrollmentSection[];
  selectedIds: ReadonlySet<string>;
  onToggle: (sectionId: string) => void;
}

/** The sections open to the student this term, with a checkbox to enlist each (AC-ENRL-001.9). */
export function CourseTable({ sections, selectedIds, onToggle }: CourseTableProps) {
  return (
    <div className="border-brand-border/25 overflow-hidden rounded-2xl border bg-white shadow-sm">
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region (WCAG 2.1.1) */}
      <div role="region" aria-label="Available courses" tabIndex={0} className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse">
          <caption className="sr-only">Courses open to you this term</caption>
          <thead className="bg-brand-maroon text-white">
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
              <th scope="col" className={th}>
                Schedule
              </th>
              <th scope="col" className={th}>
                Faculty Name
              </th>
              <th scope="col" className={th}>
                Status
              </th>
              <th scope="col" className={`${th} text-center`}>
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-brand-border/20 divide-y">
            {sections.length === 0 && (
              <tr>
                <td colSpan={7} className={`${td} text-brand-muted text-center`}>
                  No courses are open to you this term.
                </td>
              </tr>
            )}
            {sections.map((section) => {
              const full = section.availableSlots <= 0;
              const checked = selectedIds.has(section.sectionId);
              const checkboxId = `enlist-${section.sectionId}`;
              return (
                <tr key={section.sectionId} className="hover:bg-brand-paper transition-colors">
                  <th scope="row" className={`${td} text-brand-maroon text-left font-bold`}>
                    {section.courseCode}
                  </th>
                  <td className={`${td} text-brand-ink`}>{section.title}</td>
                  <td className={`${td} text-brand-ink text-center tabular-nums`}>
                    {section.units.toFixed(1)}
                  </td>
                  <td className={`${td} text-brand-ink`}>
                    <ul className="space-y-1">
                      {section.schedule.map((meeting) => (
                        <li
                          key={`${meeting.dayOfWeek}-${meeting.startTime}`}
                          className="whitespace-nowrap"
                        >
                          <span className="inline-block w-9 font-semibold">
                            {WEEKDAYS[meeting.dayOfWeek] ?? "—"}
                          </span>
                          <span className="tabular-nums">
                            {formatTimeRange(meeting.startTime, meeting.endTime)}
                          </span>
                          {meeting.room && (
                            <span className="text-brand-muted"> &middot; {meeting.room}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className={`${td} text-brand-ink whitespace-nowrap`}>
                    {section.facultyName ?? "To be announced"}
                  </td>
                  <td className={`${td} text-brand-ink`}>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${
                        full
                          ? "border-red-700/30 bg-red-100 text-red-800"
                          : "border-green-700/30 bg-green-100 text-green-800"
                      }`}
                    >
                      {full
                        ? "Full"
                        : `${section.availableSlots} seat${section.availableSlots === 1 ? "" : "s"} left`}
                    </span>
                    {section.blockReason && (
                      <p className="text-brand-muted mt-1 text-xs">{section.blockReason}</p>
                    )}
                  </td>
                  <td className={`${td} text-center`}>
                    <input
                      id={checkboxId}
                      type="checkbox"
                      className="accent-brand-maroon size-5"
                      checked={checked}
                      disabled={!checked && (full || Boolean(section.blockReason))}
                      onChange={() => onToggle(section.sectionId)}
                      aria-label={`Select ${section.courseCode}: ${section.title}, ${section.units} units`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
