import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import type { ScheduleSummary } from "./scheduleTypes";
import type { ScheduleAction } from "./useCourseSchedule";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="size-5 shrink-0"
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

const DocumentIcon = () => (
  <Icon>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3" />
  </Icon>
);
const CalendarIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Icon>
);
const Spinner = () => (
  <svg
    className="size-5 shrink-0 animate-spin motion-reduce:animate-none"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
    <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/** Google's "G", in its own colors as Google's branding guidelines ask. */
const GoogleIcon = () => (
  <svg className="size-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path
      fill="#FFC107"
      d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"
    />
    <path
      fill="#FF3D00"
      d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
    />
  </svg>
);

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center px-4 py-1 text-center">
      <dt className="text-brand-muted text-xs font-semibold tracking-wide uppercase">{label}</dt>
      <dd className="text-brand-maroon mt-1 text-4xl leading-none font-bold tabular-nums">
        {value}
      </dd>
    </div>
  );
}

const buttonBase =
  "flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-60";

interface ScheduleActionsProps {
  summary: ScheduleSummary;
  pending: ScheduleAction | null;
  onExportIcs: () => void;
  onConnectGoogle: () => void;
}

/** Total units and courses, then the three ways to take the schedule elsewhere. */
export function ScheduleActions({
  summary,
  pending,
  onExportIcs,
  onConnectGoogle,
}: ScheduleActionsProps) {
  const busy = pending !== null;

  return (
    <section
      aria-labelledby="schedule-summary-heading"
      className="border-brand-border/25 rounded-2xl border bg-white p-5 shadow-sm"
    >
      <h2 id="schedule-summary-heading" className="text-brand-ink text-base font-bold">
        Term Summary
      </h2>

      <dl className="divide-brand-border/25 border-brand-border/20 bg-brand-paper mt-4 grid grid-cols-2 divide-x rounded-xl border py-4">
        <Metric label="Total Units" value={summary.totalUnits} />
        <Metric label="Total Courses" value={summary.totalCourses} />
      </dl>

      <div className="mt-5 space-y-3 print:hidden">
        <Link
          to="/enrollment/certificate"
          className={`${buttonBase} bg-brand-maroon hover:bg-brand-maroon-dark text-white`}
          aria-label="View and print your Certificate of Registration (COR)"
        >
          <DocumentIcon />
          Download COR (PDF)
        </Link>

        <button
          type="button"
          className={`${buttonBase} border-brand-maroon text-brand-maroon hover:bg-brand-maroon/5 border-2 bg-white`}
          aria-label="Export class schedule as an iCalendar (.ics) file"
          aria-busy={pending === "ics"}
          disabled={busy}
          onClick={onExportIcs}
        >
          {pending === "ics" ? <Spinner /> : <CalendarIcon />}
          Export Calendar (.ics)
        </button>

        <button
          type="button"
          className={`${buttonBase} border-brand-input-border text-brand-input-text hover:bg-brand-paper border bg-white`}
          aria-label="Connect to Google Calendar to sync your class schedule"
          aria-busy={pending === "google"}
          disabled={busy}
          onClick={onConnectGoogle}
        >
          {pending === "google" ? <Spinner /> : <GoogleIcon />}
          Connect to Google Calendar
        </button>
      </div>
    </section>
  );
}
