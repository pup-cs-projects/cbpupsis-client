import type { DashboardTerm } from "@cbpupsis/shared/dashboard";
import type {
  EnrollmentEligibility,
  EnrollmentHold,
  EnrollmentPeriod,
  EnrollmentResult,
} from "@cbpupsis/shared/enrollment";
import { ErrorAlert } from "@cbpupsis/ui";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import "@cbpupsis/account/styles.css";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import type { CourseItem } from "../schedule/scheduleTypes";
import { useCourseSchedule } from "../schedule/useCourseSchedule";
import { ConfirmDialog } from "./ConfirmDialog";
import { CourseTable } from "./CourseTable";
import { certificateErrorMessage } from "./certificateDisplay";
import { EnlistedCourses } from "./EnlistedCourses";
import {
  enrollmentStatusLabel,
  periodDateRange,
  periodDayCount,
  periodStartDate,
  refusalMessage,
  refusalSectionIds,
  termTypeLabel,
} from "./enrollmentDisplay";
import { LimitPanel } from "./LimitPanel";
import { OverloadPanel } from "./OverloadPanel";
import { downloadCertificate } from "./useCertificate";
import {
  termSelector,
  useAvailableCourses,
  useCurrentTerm,
  useEligibility,
  useSubmitEnrollment,
} from "./useEnrollment";
import { formatTimeRange } from "../../lib/datetime";
import { formatPeso } from "../../lib/money";

function Loading() {
  return (
    <div>
      <p role="status" className="sr-only">
        Loading your enrollment information
      </p>
      <div aria-hidden="true" className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="bg-brand-skeleton/25 h-40 animate-pulse rounded-2xl motion-reduce:animate-none lg:col-span-12" />
        <div className="bg-brand-skeleton/25 h-96 animate-pulse rounded-2xl motion-reduce:animate-none lg:col-span-8" />
        <div className="bg-brand-skeleton/25 h-72 animate-pulse rounded-2xl motion-reduce:animate-none lg:col-span-4" />
      </div>
    </div>
  );
}

function HoldsPanel({ holds }: { holds: EnrollmentHold[] }) {
  const blocking = holds.filter((hold) => hold.isBlocking);
  return (
    <div className="rounded-2xl border border-red-700/30 bg-red-50 p-6">
      <h2 className="text-lg font-bold text-red-900">You have a hold on your account</h2>
      <p className="mt-1 text-sm text-red-900">Clear every hold below, then come back to enroll.</p>
      <ul className="mt-4 space-y-3">
        {blocking.map((hold, index) => (
          <li
            key={`${hold.office}-${index}`}
            className="rounded-xl border border-red-700/20 bg-white p-4 text-sm text-red-900"
          >
            <p className="font-semibold">{hold.office}</p>
            <p className="mt-1">{hold.type}</p>
            {hold.amount !== null && <p className="mt-1">Amount due: {formatPeso(hold.amount)}</p>}
            <p className="mt-2 text-red-800">
              Settle this with the {hold.office} to have it cleared. Enrollment opens to you again
              once it is.
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PeriodClosedPanel({ period }: { period: EnrollmentPeriod }) {
  return (
    <div className="border-brand-border/25 rounded-2xl border bg-white p-6 text-center">
      <h2 className="text-brand-ink text-lg font-bold">Enrollment is closed</h2>
      <p className="text-brand-muted mt-2 text-sm">
        The enrollment period runs {periodDateRange(period)}. Come back once it opens.
      </p>
    </div>
  );
}

// Terms are stored either as an identifier ("first") or already as words ("First Semester").
const SEMESTER_NAMES: Record<string, string> = {
  first: "First Semester",
  second: "Second Semester",
  summer: "Summer Term",
};

/** "(S.Y. 2026-2027, First Semester)", from the current term the dashboard names. */
function activeTermLabel(term: DashboardTerm | null | undefined): string | null {
  if (!term) return null;
  const semester = SEMESTER_NAMES[term.semester.toLowerCase()] ?? term.semester;
  return `(S.Y. ${term.academicYear}, ${semester})`;
}

function StatusBadge({ data }: { data: EnrollmentEligibility }) {
  return <span className="text-brand-ink mt-1 font-bold">{enrollmentStatusLabel(data)}</span>;
}

/** A solid check in an open circle (Lucide's CheckCircle2), not a stroke over a tinted disc. */
function CheckCircleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-9 shrink-0 text-emerald-700">
      <path
        d="M22 11.08V12a10 10 0 1 1-5.93-9.14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 4 12 14.01l-3-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** This course's real weekly meetings, read from the same `/schedule` data the Course Schedule
 * page shows: a committed section (`EnrolledSection`) carries no meeting times of its own, so
 * there is nothing to format without it. Undefined while that query hasn't resolved yet, or for
 * a course it doesn't (yet) list. */
function scheduleFor(
  courseCode: string,
  scheduleCourses: CourseItem[] | undefined,
): CourseItem["schedule"] | undefined {
  return scheduleCourses?.find((course) => course.courseCode === courseCode)?.schedule;
}

function ScheduleCell({ meetings }: { meetings: CourseItem["schedule"] | undefined }) {
  if (!meetings || meetings.length === 0) {
    return <td className="px-3 py-2.5 text-neutral-500">Not scheduled yet</td>;
  }
  return (
    <td className="px-3 py-2.5 text-neutral-900">
      <ul className="space-y-0.5">
        {meetings.map((meeting) => (
          <li key={`${meeting.day}-${meeting.timeStart}`} className="whitespace-nowrap">
            <span className="inline-block w-9 font-semibold">{meeting.day}</span>
            {formatTimeRange(meeting.timeStart, meeting.timeEnd)}
          </li>
        ))}
      </ul>
    </td>
  );
}

function EnrolledSectionsTable({ result }: { result: EnrollmentResult }) {
  const schedule = useCourseSchedule();
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200">
            <th scope="col" className="px-3 py-2 text-left font-semibold text-neutral-500">
              Course Code
            </th>
            <th scope="col" className="px-3 py-2 text-left font-semibold text-neutral-500">
              Course Title
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold text-neutral-500">
              Units
            </th>
            <th scope="col" className="px-3 py-2 text-left font-semibold text-neutral-500">
              Schedule
            </th>
          </tr>
        </thead>
        <tbody>
          {result.sections.map((section) => (
            <tr key={section.sectionId} className="border-b border-neutral-100 hover:bg-neutral-50">
              <td className="px-3 py-2.5 font-semibold text-neutral-900">{section.courseCode}</td>
              <td className="px-3 py-2.5 text-neutral-900">{section.title}</td>
              <td className="px-3 py-2.5 text-right text-neutral-900 tabular-nums">
                {section.units.toFixed(1)}
              </td>
              <ScheduleCell meetings={scheduleFor(section.courseCode, schedule.data?.courses)} />
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-sm font-bold text-neutral-900">
        Total: <span className="tabular-nums">{result.totalUnits}</span> units
      </p>
    </div>
  );
}

// Both fixed at the same size (not the rest of the page's size-5 icons), so swapping one for the
// other on click never nudges the button's text or width.
function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-2 h-4 w-4 shrink-0" fill="none">
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6M12 12v5m0 0 3-3m-3 3-3-3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="mr-2 h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Downloads the official Certificate of Registration PDF the API renders, issuing it first
 * if it has not been issued yet (US-ENRL-003). */
function DownloadCorButton({ termId }: { termId: string | undefined }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!termId) return;
    setError(null);
    setDownloading(true);
    try {
      await downloadCertificate(termId);
    } catch (err) {
      setError(certificateErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
      <button
        type="button"
        onClick={() => {
          if (!downloading) void handleClick();
        }}
        disabled={!termId}
        aria-busy={downloading}
        className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#7B1113] px-4 text-sm font-medium text-white transition-colors hover:bg-[#630e10] focus-visible:ring-2 focus-visible:ring-[#7B1113] focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
      >
        {downloading ? <Spinner /> : <DownloadIcon />}
        {downloading ? "Preparing COR..." : "Download Certificate of Registration (COR)"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-700 sm:max-w-xs sm:text-right">
          {error}
        </p>
      )}
    </div>
  );
}

function EnrolledCompletionPanel({
  data,
  result,
  term,
}: {
  data: EnrollmentEligibility;
  result: EnrollmentResult;
  term: DashboardTerm | null | undefined;
}) {
  return (
    <section
      aria-labelledby="officially-enrolled-title"
      className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <CheckCircleIcon />
          <div>
            <h2 id="officially-enrolled-title" className="text-xl font-bold text-neutral-900">
              You&apos;re enrolled
            </h2>
            {activeTermLabel(term) && (
              <p className="mt-0.5 text-sm text-neutral-500">{activeTermLabel(term)}</p>
            )}
          </div>
        </div>

        <DownloadCorButton termId={term?.id} />
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <dt className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Allowed Units
          </dt>
          <dd className="mt-1 text-lg font-bold text-neutral-900 tabular-nums">
            {data.effectiveCeiling.toFixed(0)} units
          </dd>
        </div>
      </dl>

      {result.sections.length > 0 && <EnrolledSectionsTable result={result} />}

      <Link
        to="/enrollment/certificate"
        className="text-brand-crimson mt-6 inline-flex min-h-11 items-center text-sm font-semibold underline"
      >
        View your Certificate of Registration
      </Link>
    </section>
  );
}

/** US-ENRL-001: pick sections, watch the running total against the real limit, then submit. */
export function EnrollmentPage() {
  const eligibility = useEligibility();
  const currentTerm = useCurrentTerm();
  const data = eligibility.data;
  const term = currentTerm.data ? termSelector(currentTerm.data) : undefined;
  const coursesEnabled = Boolean(data?.isEligible && data.academicPeriod.isOpen);
  const courses = useAvailableCourses(term, coursesEnabled);
  const submit = useSubmitEnrollment(term);

  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedSections = useMemo(
    () => (courses.data ?? []).filter((section) => selectedIds.has(section.sectionId)),
    [courses.data, selectedIds],
  );
  const runningTotal = selectedSections.reduce((sum, section) => sum + section.units, 0);

  function toggle(sectionId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  function clearAll() {
    setSelectedIds(new Set());
  }

  // Mutually exclusive and exhaustive once `data` loads, in the order the picker gives way:
  // a closed period first, then a blocking hold, then any other ineligibility, else the picker.
  const blockingHold = data?.holds.find((hold) => hold.isBlocking);
  const showPeriodClosed = Boolean(data && !data.academicPeriod.isOpen);
  const showHolds = Boolean(data && !showPeriodClosed && !data.isEligible && blockingHold);
  const showIneligible = Boolean(data && !showPeriodClosed && !showHolds && !data.isEligible);
  const showPicker = Boolean(data && data.isEligible && data.academicPeriod.isOpen);
  // A refusal that names sections (a conflict, a full section) is repeated beside them.
  const refusal = submit.isError
    ? { sectionIds: refusalSectionIds(submit.error), message: refusalMessage(submit.error) }
    : null;

  return (
    <DashboardLayout>
      {/* The inline card below is the one retry action for an eligibility failure; this toast
          is awareness only, so the page never offers two differently-placed "Try again"s. */}
      {eligibility.isError && <ErrorAlert error={eligibility.error} />}
      {courses.isError && (
        <ErrorAlert error={courses.error} onRetry={() => void courses.refetch()} />
      )}
      {currentTerm.isError && (
        <ErrorAlert error={currentTerm.error} onRetry={() => void currentTerm.refetch()} />
      )}

      <div className="space-y-6 px-4 py-8 sm:px-8">
        <nav aria-label="Breadcrumb">
          <ol className="text-brand-muted flex flex-wrap items-center gap-1.5 text-sm">
            <li>Academics</li>
            <li aria-hidden="true">&gt;</li>
            <li aria-current="page" className="text-brand-ink font-semibold">
              Enrollment
            </li>
          </ol>
        </nav>

        <div>
          <h1 className="text-brand-maroon text-3xl font-bold tracking-tight sm:text-4xl">
            Course Enrollment
          </h1>
        </div>

        {eligibility.isPending && <Loading />}

        {eligibility.isError && (
          <div className="border-brand-border/25 rounded-2xl border bg-white px-6 py-10 text-center shadow-sm">
            <p className="text-brand-ink font-semibold">
              We couldn&apos;t load your enrollment information.
            </p>
            <p className="text-brand-muted mt-1 text-sm">
              Check your connection and try again. If it keeps happening, contact the registrar.
            </p>
            <button
              type="button"
              onClick={() => void eligibility.refetch()}
              className="bg-brand-crimson mt-5 min-h-11 rounded-xl px-5 text-sm font-semibold text-white hover:opacity-90"
            >
              Try again
            </button>
          </div>
        )}

        {data && (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
              <div>
                <dt className="text-brand-muted text-xs font-semibold tracking-wide uppercase">
                  Semester
                </dt>
                <dd className="text-brand-ink mt-1 font-bold">{termTypeLabel(data.termType)}</dd>
              </div>
              <div>
                <dt className="text-brand-muted text-xs font-semibold tracking-wide uppercase">
                  Next Enrollment Date
                </dt>
                <dd className="text-brand-ink mt-1 font-bold">
                  {periodStartDate(data.academicPeriod)}
                </dd>
              </div>
              <div>
                <dt className="text-brand-muted text-xs font-semibold tracking-wide uppercase">
                  Period
                </dt>
                <dd className="text-brand-ink mt-1 font-bold">
                  {periodDayCount(data.academicPeriod)} Days
                </dd>
              </div>
              <div>
                <dt className="text-brand-muted text-xs font-semibold tracking-wide uppercase">
                  Status
                </dt>
                <dd className="mt-1" data-testid="enrollment-status-value">
                  <StatusBadge data={data} />
                </dd>
              </div>
            </dl>

            {showPeriodClosed && <PeriodClosedPanel period={data.academicPeriod} />}
            {showHolds && <HoldsPanel holds={data.holds} />}
            {showIneligible && (
              <div className="border-brand-border/25 rounded-2xl border bg-white p-6 text-center">
                <h2 className="text-brand-ink text-lg font-bold">
                  You are not eligible to enroll right now
                </h2>
                {data.reasons.length > 0 ? (
                  <ul className="text-brand-muted mt-2 space-y-1 text-sm">
                    {data.reasons.map((reason) => (
                      <li key={reason.code}>{reason.message}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-brand-muted mt-2 text-sm">
                    Contact the registrar to find out why, then come back.
                  </p>
                )}
              </div>
            )}

            {showPicker && submit.isSuccess && (
              <EnrolledCompletionPanel data={data} result={submit.data} term={currentTerm.data} />
            )}

            {showPicker && !submit.isSuccess && (
              <>
                <LimitPanel
                  eligibility={data}
                  runningTotal={runningTotal}
                  subjectCount={selectedSections.length}
                />

                {courses.isPending && <Loading />}

                {courses.isSuccess && (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="min-w-0 space-y-6 lg:col-span-8">
                      <CourseTable
                        sections={courses.data}
                        selectedIds={selectedIds}
                        onToggle={toggle}
                        refusal={refusal}
                      />
                    </div>
                    <aside
                      aria-label="Enlisted courses and overload"
                      className="space-y-6 lg:sticky lg:top-6 lg:col-span-4 lg:self-start"
                    >
                      <EnlistedCourses
                        sections={selectedSections}
                        totalUnits={runningTotal}
                        onClearAll={clearAll}
                        onRemove={toggle}
                      />

                      {submit.isError && (
                        <div
                          role="alert"
                          className="rounded-2xl border border-red-700/30 bg-red-50 p-4 text-sm text-red-900"
                        >
                          <p className="font-bold">We could not submit your enrollment.</p>
                          <p className="mt-1">{refusal?.message}</p>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={selectedSections.length === 0 || submit.isPending || !term}
                        onClick={() => setConfirmOpen(true)}
                        className="bg-brand-crimson hover:bg-brand-crimson-dark min-h-11 w-full rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Review and Submit
                      </button>

                      {term && <OverloadPanel eligible={data.overloadEligible} term={term} />}
                    </aside>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {confirmOpen && (
        <ConfirmDialog
          sections={selectedSections}
          totalUnits={runningTotal}
          pending={submit.isPending}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            submit.mutate(
              selectedSections.map((section) => section.sectionId),
              { onSuccess: () => setConfirmOpen(false) },
            );
          }}
        />
      )}
    </DashboardLayout>
  );
}
