import { useState } from "react";

import { formatTimeRange, manilaWeekday } from "../../lib/datetime";
import { WEEKDAYS, type CourseItem, type CourseMeeting, type Weekday } from "./scheduleTypes";

const DAY_NAMES: Record<Weekday, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

interface Slot {
  course: CourseItem;
  meeting: CourseMeeting;
}

/** Every meeting on `day`, earliest first. "HH:mm" strings sort as times. */
function slotsOn(courses: CourseItem[], day: Weekday): Slot[] {
  return courses
    .flatMap((course) =>
      course.schedule.filter((m) => m.day === day).map((meeting) => ({ course, meeting })),
    )
    .sort((a, b) => a.meeting.timeStart.localeCompare(b.meeting.timeStart));
}

/** Google-Calendar-style block. One maroon accent for every class: color carries no meaning. */
function ClassBlock({ course, meeting }: Slot) {
  return (
    <li className="bg-brand-maroon/5 rounded-lg px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="bg-brand-maroon/10 text-brand-maroon rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap">
          {course.courseCode}
        </span>
        <span className="text-brand-ink text-xs font-medium whitespace-nowrap tabular-nums">
          {formatTimeRange(meeting.timeStart, meeting.timeEnd)}
        </span>
      </div>
      <p className="text-brand-ink mt-1 truncate text-sm font-semibold" title={course.courseTitle}>
        {course.courseTitle}
      </p>
      <p className="text-brand-muted text-xs">{course.location}</p>
    </li>
  );
}

type View = "today" | "week";

/** A compact look at the classes ahead: today's, or the whole week's by day. */
export function WeekGlance({ courses }: { courses: CourseItem[] }) {
  const [view, setView] = useState<View>("today");
  const today = manilaWeekday() as Weekday;
  const todaySlots = slotsOn(courses, today);
  const week = WEEKDAYS.map((day) => ({ day, slots: slotsOn(courses, day) })).filter(
    ({ slots }) => slots.length > 0,
  );

  const tab = (value: View, label: string) => (
    <button
      type="button"
      aria-pressed={view === value}
      onClick={() => setView(value)}
      className="text-brand-muted aria-pressed:text-brand-maroon min-h-9 flex-1 rounded-md px-3 text-xs font-semibold transition-colors aria-pressed:bg-white aria-pressed:shadow-sm"
    >
      {label}
    </button>
  );

  return (
    <section
      aria-labelledby="week-glance-heading"
      className="border-brand-border/25 rounded-2xl border bg-white p-5 shadow-sm print:hidden"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="week-glance-heading" className="text-brand-ink text-base font-bold">
          {view === "today" ? "Today's Classes" : "Week Glance"}
        </h2>
        <div
          role="group"
          aria-label="Classes to show"
          className="bg-brand-paper flex rounded-lg p-1"
        >
          {tab("today", "Today")}
          {tab("week", "Week")}
        </div>
      </div>

      {view === "today" ? (
        <>
          <p className="text-brand-muted mt-1 text-xs">{DAY_NAMES[today]}</p>
          {todaySlots.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {todaySlots.map((slot) => (
                <ClassBlock key={slot.course.id + slot.meeting.timeStart} {...slot} />
              ))}
            </ul>
          ) : (
            <p className="bg-brand-paper text-brand-muted mt-3 rounded-lg px-3 py-4 text-center text-sm">
              No classes today.
            </p>
          )}
        </>
      ) : (
        // Capped so the sticky rail still fits a laptop screen; focusable to scroll by keyboard.
        <div
          role="region"
          aria-label="This week's classes"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region (WCAG 2.1.1)
          tabIndex={0}
          className="mt-3 max-h-[26rem] space-y-4 overflow-y-auto pr-1"
        >
          {week.map(({ day, slots }) => (
            <div key={day}>
              <h3
                className={`text-xs font-bold tracking-wide uppercase ${
                  day === today ? "text-brand-maroon" : "text-brand-muted"
                }`}
              >
                {DAY_NAMES[day]}
                {day === today && <span className="font-semibold normal-case"> · Today</span>}
              </h3>
              <ul className="mt-1.5 space-y-2">
                {slots.map((slot) => (
                  <ClassBlock key={slot.course.id + slot.meeting.timeStart} {...slot} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
