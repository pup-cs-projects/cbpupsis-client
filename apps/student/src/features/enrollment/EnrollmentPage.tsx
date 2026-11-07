import type { EnrollmentHold, EnrollmentPeriod } from "@cbpupsis/shared/enrollment";
import { ErrorAlert } from "@cbpupsis/ui";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import "@cbpupsis/account/styles.css";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { ConfirmDialog } from "./ConfirmDialog";
import { CourseTable } from "./CourseTable";
import { EnlistedCourses } from "./EnlistedCourses";
import {
  enrollmentStatusLabel,
  periodDateRange,
  periodDayCount,
  periodStartDate,
  refusalMessage,
  termTypeLabel,
} from "./enrollmentDisplay";
import { LimitPanel } from "./LimitPanel";
import { OverloadPanel } from "./OverloadPanel";
import { useAvailableCourses, useEligibility, useSubmitEnrollment } from "./useEnrollment";
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

/** US-ENRL-001: pick sections, watch the running total against the real limit, then submit. */
export function EnrollmentPage() {
  const eligibility = useEligibility();
  const data = eligibility.data;
  const coursesEnabled = Boolean(data?.isEligible && data.academicPeriod.isOpen);
  const courses = useAvailableCourses(coursesEnabled);
  const submit = useSubmitEnrollment();

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

  return (
    <DashboardLayout>
      {/* The inline card below is the one retry action for an eligibility failure; this toast
          is awareness only, so the page never offers two differently-placed "Try again"s. */}
      {eligibility.isError && <ErrorAlert error={eligibility.error} />}
      {courses.isError && (
        <ErrorAlert error={courses.error} onRetry={() => void courses.refetch()} />
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
                  Enrollment Date
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
                <dd className="text-brand-ink mt-1 font-bold">{enrollmentStatusLabel(data)}</dd>
              </div>
            </dl>

            {showPeriodClosed && <PeriodClosedPanel period={data.academicPeriod} />}
            {showHolds && <HoldsPanel holds={data.holds} />}
            {showIneligible && (
              <div className="border-brand-border/25 rounded-2xl border bg-white p-6 text-center">
                <h2 className="text-brand-ink text-lg font-bold">
                  You are not eligible to enroll right now
                </h2>
                <p className="text-brand-muted mt-2 text-sm">
                  Contact the registrar to find out why, then come back.
                </p>
              </div>
            )}

            {showPicker && submit.isSuccess && (
              <div className="border-brand-success/30 rounded-2xl border bg-white p-6">
                <h2 className="text-brand-success text-lg font-bold">You&apos;re enrolled</h2>
                <ul className="divide-brand-border/20 mt-4 divide-y text-sm">
                  {submit.data.sections.map((section) => (
                    <li key={section.sectionId} className="flex justify-between gap-3 py-2.5">
                      <span className="text-brand-ink font-semibold">
                        {section.courseCode}: {section.title}
                      </span>
                      <span className="text-brand-ink tabular-nums">
                        {section.units.toFixed(1)}u
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-brand-ink mt-4 text-sm font-bold">
                  Total: <span className="tabular-nums">{submit.data.totalUnits}</span> units
                </p>
                <Link
                  to="/enrollment/certificate"
                  className="bg-brand-crimson hover:bg-brand-crimson-dark mt-5 inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold text-white"
                >
                  View your Certificate of Registration
                </Link>
              </div>
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
                          <p className="mt-1">
                            {refusalMessage(submit.error, data.summerSubjectCap)}
                          </p>
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={selectedSections.length === 0 || submit.isPending}
                        onClick={() => setConfirmOpen(true)}
                        className="bg-brand-crimson hover:bg-brand-crimson-dark min-h-11 w-full rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Review and Submit
                      </button>

                      <OverloadPanel eligible={data.overloadEligible} />
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
