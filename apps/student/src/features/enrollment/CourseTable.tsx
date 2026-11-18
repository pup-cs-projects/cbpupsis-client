import type { EnrollmentSection } from "@cbpupsis/shared/enrollment";

import { formatTimeRange } from "../../lib/datetime";
import { BlockedCourse } from "./BlockedCourse";
import { WEEKDAYS } from "./enrollmentDisplay";

const th = "px-6 py-3.5 text-left text-xs font-semibold tracking-wider whitespace-nowrap uppercase";
const td = "px-6 py-4 align-top text-sm";

interface CourseTableProps {
  sections: EnrollmentSection[];
  selectedIds: ReadonlySet<string>;
  onToggle: (sectionId: string) => void;
  /** The last submit refusal, shown in the row of each section it names. */
  refusal?: { sectionIds: string[]; message: string } | null;
  /** Called after a waiver is filed from a blocked row, so the list can reload. */
  onWaiverFiled?: () => void;
}

/** Whether a blocked section still has a path to enlist: a waiver the student can file, or one
 * already filed and pending. Those rows stay fully interactive so the waiver panel stays
 * reachable; a hard block (no waiver path at all) collapses to a disabled row instead. */
function hasWaiverPath(section: EnrollmentSection): boolean {
  return (
    section.waiverAvailable ||
    section.blocks.some((block) => block.rule === "ENROLL_WAIVER_PENDING")
  );
}

/** The sections open to the student this term, styled to match the portal's other tables (My
 * Schedule): one merged Course Code & Title column, a solid maroon header (AC-ENRL-001.9). */
export function CourseTable({
  sections,
  selectedIds,
  onToggle,
  refusal,
  onWaiverFiled,
}: CourseTableProps) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region (WCAG 2.1.1) */}
      <div role="region" aria-label="Available courses" tabIndex={0} className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse">
          <caption className="sr-only">Courses open to you this term</caption>
          <thead className="bg-brand-crimson text-white">
            <tr>
              <th scope="col" className={th}>
                Course Code &amp; Title
              </th>
              <th scope="col" className={th}>
                Units
              </th>
              <th scope="col" className={th}>
                Schedule
              </th>
              <th scope="col" className={th}>
                Faculty Name
              </th>
              <th scope="col" className={`${th} text-right`}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {sections.length === 0 && (
              <tr>
                <td colSpan={5} className={`${td} text-center text-neutral-500`}>
                  No courses are open to you this term.
                </td>
              </tr>
            )}
            {sections.map((section) => {
              const full = section.availableSlots <= 0;
              // The only signal the API gives for "cannot enlist here": the same check the
              // checkbox itself has always used. `blocks`/`prerequisitesSatisfied` are richer
              // diagnostic detail BlockedCourse reads on its own; they do not gate the checkbox.
              const checkboxBlocked = Boolean(section.blockReason);
              const hardBlocked = checkboxBlocked && !hasWaiverPath(section);
              const disabledRow = full || hardBlocked;
              const checked = selectedIds.has(section.sectionId);
              const checkboxId = `enlist-${section.sectionId}`;

              return (
                <tr
                  key={section.sectionId}
                  className={`border-b border-neutral-100 last:border-b-0 ${
                    disabledRow
                      ? "pointer-events-none cursor-not-allowed bg-neutral-50/80 opacity-50 select-none"
                      : "transition-colors hover:bg-neutral-50/50"
                  }`}
                >
                  <th scope="row" className={`${td} text-left font-normal`}>
                    <span className="text-brand-crimson block text-sm font-bold">
                      {section.courseCode}
                    </span>
                    <span className="block text-sm text-neutral-700">{section.title}</span>
                    {full && <p className="mt-1 text-xs text-neutral-400 italic">Full</p>}
                    {hardBlocked && (
                      <p className="mt-1 text-xs text-neutral-400 italic">{section.blockReason}</p>
                    )}
                    {!hardBlocked && (
                      <div className="mt-2 min-w-[16rem]">
                        <BlockedCourse section={section} onWaiverFiled={onWaiverFiled} />
                      </div>
                    )}
                    {refusal?.sectionIds.includes(section.sectionId) && (
                      <p className="mt-1 text-xs font-semibold text-red-800">{refusal.message}</p>
                    )}
                  </th>
                  <td className={`${td} text-neutral-700 tabular-nums`}>
                    {section.units.toFixed(1)}
                  </td>
                  <td className={`${td} text-neutral-700`}>
                    <ul className="space-y-1">
                      {section.schedule.map((meeting) => (
                        <li
                          key={`${meeting.dayOfWeek}-${meeting.startTime}`}
                          className="whitespace-nowrap"
                        >
                          <span className="font-semibold">{WEEKDAYS[meeting.dayOfWeek] ?? ""}</span>{" "}
                          <span className="font-normal tabular-nums">
                            {formatTimeRange(meeting.startTime, meeting.endTime)}
                          </span>
                          {meeting.room && (
                            <span className="text-neutral-500"> &middot; {meeting.room}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className={`${td} whitespace-nowrap text-neutral-700`}>
                    {section.facultyName ?? "To be announced"}
                  </td>
                  <td className={`${td} text-right`}>
                    <input
                      id={checkboxId}
                      type="checkbox"
                      className="border-brand-crimson accent-brand-crimson h-5 w-5 cursor-pointer rounded border-2 disabled:cursor-not-allowed disabled:border-neutral-300"
                      checked={checked}
                      disabled={!checked && (full || checkboxBlocked)}
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
