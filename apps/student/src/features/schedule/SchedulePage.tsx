import { ApiError } from "@cbpupsis/shared/api";
import { ErrorAlert, Notice } from "@cbpupsis/ui";
import { useState } from "react";

import "@cbpupsis/account/styles.css";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { CourseTable } from "./CourseTable";
import { GoogleCalendarDialog } from "./GoogleCalendarDialog";
import { GoogleCalendarPanel } from "./GoogleCalendarPanel";
import { GOOGLE_CALENDAR_MESSAGES, googleCalendarStatusError } from "./googleCalendar";
import { useGoogleCalendar } from "./useGoogleCalendar";
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
  const calendar = useGoogleCalendar();
  const data = schedule.data;
  const connection = calendar.status.data;
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Google Calendar details are a pop-up, not a card: the page shows Connect when disconnected
  // and Manage only when connected (or when a withdrawn permission needs Disconnect).
  const withdrawn =
    calendar.status.error instanceof ApiError && calendar.status.error.status === 403;
  const manageAvailable = withdrawn || Boolean(connection?.connected);
  // While the pop-up is open it shows these itself; never both at once.
  const inline = !calendarOpen;

  return (
    <DashboardLayout>
      {schedule.isError && (
        <ErrorAlert error={schedule.error} onRetry={() => void schedule.refetch()} />
      )}
      {actions.error && <ErrorAlert error={actions.error} onRetry={actions.retry} />}
      {actions.notice && <Notice tone={actions.notice.tone}>{actions.notice.text}</Notice>}

      <div className="space-y-6 px-4 py-8 sm:px-8">
        <nav aria-label="Breadcrumb">
          <ol className="mb-2 flex items-center gap-1.5 text-xs text-neutral-500">
            <li>Academics</li>
            <li aria-hidden="true">&gt;</li>
            <li aria-current="page" className="text-brand-ink font-semibold">
              My Schedule
            </li>
          </ol>
        </nav>

        <div>
          <h1 className="text-brand-crimson text-3xl font-bold tracking-tight sm:text-4xl">
            Course Schedule
          </h1>
          <p className="mt-1 mb-6 max-w-3xl text-sm leading-relaxed text-neutral-600">
            Your enrolled classes for the term. Download your schedule or add your classes to your
            calendar.
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

        <div className={data ? "grid grid-cols-1 gap-6 lg:grid-cols-12" : "max-w-xl"}>
          {data && (
            <div className="min-w-0 lg:col-span-8">
              <CourseTable courses={data.courses} summary={data.summary} />
            </div>
          )}
          <aside
            aria-label="Schedule summary and actions"
            className={
              data
                ? "min-w-0 space-y-6 lg:sticky lg:top-6 lg:col-span-4 lg:self-start"
                : "space-y-6"
            }
          >
            {data && (
              <ScheduleActions
                summary={data.summary}
                pending={actions.pending}
                onDownloadCor={actions.downloadCor}
                onExportIcs={actions.exportIcs}
                onConnectGoogle={() => calendar.connect(data.term)}
                onManageGoogle={() => setCalendarOpen(true)}
                google={{
                  connecting: calendar.connecting,
                  busy: calendar.busy,
                  canConnect: calendar.canConnect,
                  loading: calendar.status.isPending,
                  manageAvailable,
                  disabledReason:
                    connection?.enabled === false
                      ? calendar.canConnect
                        ? GOOGLE_CALENDAR_MESSAGES.connectAttempt
                        : GOOGLE_CALENDAR_MESSAGES.disabled
                      : undefined,
                  statusError:
                    inline && calendar.status.isError
                      ? googleCalendarStatusError(calendar.status.error)
                      : undefined,
                  onRetryStatus: calendar.refresh,
                  retryingStatus: calendar.status.isFetching,
                  lastError: inline ? connection?.lastError : null,
                  feedback: inline ? calendar.feedback : null,
                  onDismissFeedback: calendar.clearFeedback,
                }}
              />
            )}
            {!data && (
              <GoogleCalendarPanel calendar={calendar} currentTerm={undefined} showConnectButton />
            )}
            {data && <WeekGlance courses={data.courses} />}
          </aside>
        </div>
      </div>
      {data && calendarOpen && (
        <GoogleCalendarDialog busy={calendar.busy} onClose={() => setCalendarOpen(false)}>
          <GoogleCalendarPanel
            calendar={calendar}
            currentTerm={data.term}
            bare
            onDisconnected={() => {
              // Nothing left to manage: close the pop-up and leave the notice and Connect.
              setCalendarOpen(false);
              setTimeout(() => document.getElementById("google-calendar-connect")?.focus(), 0);
            }}
          />
        </GoogleCalendarDialog>
      )}
    </DashboardLayout>
  );
}
