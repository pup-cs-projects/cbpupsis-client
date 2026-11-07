import { ErrorAlert, Notice } from "@cbpupsis/ui";

import "@cbpupsis/account/styles.css";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { CourseTable } from "./CourseTable";
import { ScheduleActions } from "./ScheduleActions";
import { useCourseSchedule, useScheduleActions } from "./useCourseSchedule";
import { WeekGlance } from "./WeekGlance";

const ChevronRightIcon = () => (
  <svg
    className="size-4 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M9 6l6 6-6 6" />
  </svg>
);

function Loading() {
  return (
    <div>
      <p role="status" className="sr-only">
        Loading your schedule
      </p>
      <div aria-hidden="true" className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="bg-brand-skeleton/25 h-96 animate-pulse rounded-2xl motion-reduce:animate-none lg:col-span-8" />
        <div className="bg-brand-skeleton/25 h-72 animate-pulse rounded-2xl motion-reduce:animate-none lg:col-span-4" />
      </div>
    </div>
  );
}

/** US-STU-003: the student's classes this term, and ways to take them elsewhere. */
export function SchedulePage() {
  const schedule = useCourseSchedule();
  const actions = useScheduleActions();
  const data = schedule.data;

  return (
    <DashboardLayout>
      {schedule.isError && (
        <ErrorAlert error={schedule.error} onRetry={() => void schedule.refetch()} />
      )}
      {actions.error && <ErrorAlert error={actions.error} onRetry={actions.retry} />}
      {actions.notice && <Notice tone={actions.notice.tone}>{actions.notice.text}</Notice>}

      <div className="space-y-6 px-4 py-8 sm:px-8">
        <div>
          <h1 className="text-brand-maroon text-3xl font-bold tracking-tight sm:text-4xl">
            Course Schedule
          </h1>
          <p className="text-brand-muted mt-2 max-w-3xl text-sm leading-relaxed">
            Your enrolled classes for the term. Download your Certificate of Registration or add
            your classes to your calendar.
          </p>
        </div>

        {schedule.isPending && <Loading />}

        {schedule.isSuccess && !data && (
          <p className="border-brand-border/25 text-brand-muted rounded-2xl border bg-white px-6 py-10 text-center text-sm">
            Your schedule isn't available yet. It appears here once your enrollment is confirmed.
          </p>
        )}

        {data && (
          // Term header. Choosing another term isn't built yet: unavailable, never dead.
          <h2 className="text-brand-ink flex flex-wrap items-center gap-x-2 text-lg font-bold sm:text-xl">
            <span>Academic Year {data.summary.academicYear}</span>
            <span aria-hidden="true" className="text-brand-border font-normal">
              |
            </span>
            <span className="sr-only">, </span>
            <button
              type="button"
              aria-disabled="true"
              title="Coming soon"
              className="text-brand-maroon inline-flex min-h-11 cursor-default items-center gap-1 rounded-md"
            >
              {data.summary.semester}
              <ChevronRightIcon />
              <span className="sr-only">: choose another term, coming soon</span>
            </button>
          </h2>
        )}

        {/* The header sits above the grid, so the table and the summary start on one line. */}
        {data && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-8">
              <CourseTable courses={data.courses} summary={data.summary} />
            </div>

            {/* The rail stays in view while the table scrolls; one column below 1024px. */}
            <aside
              aria-label="Schedule summary and actions"
              className="space-y-6 lg:sticky lg:top-6 lg:col-span-4 lg:self-start"
            >
              <ScheduleActions
                summary={data.summary}
                pending={actions.pending}
                onExportIcs={actions.exportIcs}
                onConnectGoogle={actions.connectGoogleCalendar}
              />
              <WeekGlance courses={data.courses} />
            </aside>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
