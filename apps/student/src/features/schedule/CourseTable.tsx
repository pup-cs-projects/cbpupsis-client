import { formatTimeRange } from "../../lib/datetime";
import type { CourseItem, ScheduleSummary } from "./scheduleTypes";

const th = "px-4 py-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap uppercase";
const td = "px-4 py-4 align-top text-sm";

interface CourseTableProps {
  courses: CourseItem[];
  summary: ScheduleSummary;
}

/** The term's classes, one row each. Scrolls sideways inside its card on narrow screens. */
export function CourseTable({ courses, summary }: CourseTableProps) {
  const caption = `Courses for ${summary.semester}, Academic Year ${summary.academicYear}`;

  return (
    <div className="border-brand-border/25 overflow-hidden rounded-2xl border bg-white shadow-sm">
      {/* A keyboard user can focus the region to scroll it when the table is wider than it. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region (WCAG 2.1.1) */}
      <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-brand-maroon text-white">
            <tr>
              <th scope="col" className={th}>
                Course Code &amp; Title
              </th>
              <th scope="col" className={`${th} text-center`}>
                Units
              </th>
              <th scope="col" className={th}>
                Schedule
              </th>
              <th scope="col" className={th}>
                Faculty
              </th>
              <th scope="col" className={th}>
                Location
              </th>
            </tr>
          </thead>
          <tbody className="divide-brand-border/20 divide-y">
            {courses.map((course) => (
              <tr key={course.id} className="hover:bg-brand-paper transition-colors">
                <th scope="row" className={`${td} text-left font-normal`}>
                  <span className="text-brand-maroon block font-bold whitespace-nowrap">
                    {course.courseCode}
                  </span>
                  <span className="text-brand-ink block">{course.courseTitle}</span>
                </th>
                <td className={`${td} text-brand-ink text-center tabular-nums`}>
                  {course.units.toFixed(1)}
                </td>
                <td className={`${td} text-brand-ink`}>
                  <ul className="space-y-1">
                    {course.schedule.map((meeting) => (
                      <li key={meeting.day + meeting.timeStart} className="whitespace-nowrap">
                        <span className="inline-block w-9 font-semibold">{meeting.day}</span>
                        <span className="tabular-nums">
                          {formatTimeRange(meeting.timeStart, meeting.timeEnd)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className={`${td} text-brand-ink`}>{course.faculty}</td>
                <td className={`${td} text-brand-ink whitespace-nowrap`}>{course.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
