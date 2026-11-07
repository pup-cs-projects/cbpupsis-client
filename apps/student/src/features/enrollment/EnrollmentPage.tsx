import type {
  Certificate,
  EnrollmentEligibility,
  EnrollmentHold,
  EnrollmentPeriod,
  EnrollmentResult,
} from "@cbpupsis/shared/enrollment";
import { ErrorAlert } from "@cbpupsis/ui";
import { useMemo, useState } from "react";

import "@cbpupsis/account/styles.css";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { useStudentProfile } from "../profile/useStudentProfile";
import type { CourseItem } from "../schedule/scheduleTypes";
import { useCourseSchedule } from "../schedule/useCourseSchedule";
import { ConfirmDialog } from "./ConfirmDialog";
import { buildCorPrintHtml, getVerificationQrDataUrl } from "./CorPrintTemplate";
import { CourseTable } from "./CourseTable";
import { FALLBACK_ADDRESS, FALLBACK_CONTACT } from "./corDisplay";
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
import { certificateApi } from "./useCertificate";
import { useAvailableCourses, useEligibility, useSubmitEnrollment } from "./useEnrollment";
import { formatTimeRange } from "../../lib/datetime";
import { downloadCertificatePdf } from "../../lib/downloadCertificatePdf";
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

function isAlreadyEnrolled(data: EnrollmentEligibility | undefined): boolean {
  return Boolean(
    data &&
    (data.isEnrolled ||
      data.enrollmentStatus?.toUpperCase() === "ENROLLED" ||
      data.currentEnrollment),
  );
}

function activeTermLabel(data: EnrollmentEligibility): string {
  const [startYear, rest] = data.term.split("-");
  const endYear = rest?.slice(0, 4);
  const semester = data.term.toLowerCase().includes("second")
    ? "Second Semester"
    : data.term.toLowerCase().includes("summer") || data.termType === "SUMMER"
      ? "Summer Term"
      : "First Semester";
  return startYear && endYear
    ? `(S.Y. ${startYear}–${endYear} - ${semester})`
    : termTypeLabel(data.termType);
}

function nextEnrollmentDate(data: EnrollmentEligibility): string {
  if (!isAlreadyEnrolled(data)) return periodStartDate(data.academicPeriod);
  return data.nextEnrollmentPeriod ? periodDateRange(data.nextEnrollmentPeriod) : "TBA";
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

function InfoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 16v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** This course's real weekly meetings, read from the same `/schedule` data the Course Schedule
 * page shows — a committed section (`EnrolledSection`) carries no meeting times of its own, so
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
    return <td className="px-3 py-2.5 text-neutral-500">—</td>;
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

const DAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

/** A complete local COR preview keeps the localhost demo useful before the registrar fixture has
 * finalized a matching record. It is development-only; production always prints the API-issued
 * certificate and its verification URL. */
function developmentCertificate(
  data: EnrollmentEligibility,
  result: EnrollmentResult,
  profile: ReturnType<typeof useStudentProfile>["data"],
  scheduleCourses: CourseItem[] | undefined,
): Certificate {
  const [startYear, endYear, semester = "first"] = data.term.split("-");
  return {
    certificateId: `local-cor-${data.termId}`,
    issuedAt: new Date().toISOString(),
    status: "CURRENT",
    name: profile?.personalInfo.fullLegalName || "Local Student",
    studentNumber: profile?.credentials.studentId || "LOCAL-STUDENT",
    program: profile?.personalInfo.program || "Bachelor of Science in Computer Science",
    term: { id: data.termId, year: endYear ? `${startYear}-${endYear}` : data.term, semester },
    courses: result.sections.map((section) => {
      const scheduledCourse = scheduleCourses?.find(
        (course) => course.courseCode === section.courseCode,
      );
      return {
        sectionId: section.sectionId,
        code: section.courseCode,
        title: section.title,
        section: data.enrollmentSection ?? "TBA",
        schedule: (scheduledCourse?.schedule ?? []).map((meeting) => ({
          dayOfWeek: DAY_INDEX[meeting.day] ?? 0,
          startTime: meeting.timeStart,
          endTime: meeting.timeEnd,
          room: scheduledCourse?.location ?? null,
          type: "Lecture",
        })),
        room: scheduledCourse?.location ?? null,
        faculty: scheduledCourse?.faculty ?? null,
        units: section.units,
      };
    }),
    totalUnits: result.totalUnits,
    assessment: {
      lines: [],
      amountAssessed: 0,
      subsidyApplied: 0,
      netPayable: 0,
      fheQualified: Boolean(data.qualifiedForFreeHigherEducation),
      fheForfeited: false,
      fheForfeitureReason: null,
    },
    verificationUrl: `${window.location.origin}/verify/local-cor/${data.termId}`,
  };
}

/** Builds the COR and downloads it as an A4-landscape PDF without leaving /enrollment. */
function DownloadCorButton({
  data,
  result,
}: {
  data: EnrollmentEligibility;
  result: EnrollmentResult | null | undefined;
}) {
  const profile = useStudentProfile();
  const schedule = useCourseSchedule();
  const isCorFinal = data.isCorFinal ?? data.corStatus?.toUpperCase() === "FINAL";
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setPrinting(true);
    try {
      let certificate =
        import.meta.env.MODE === "development" && result
          ? developmentCertificate(data, result, profile.data, schedule.data?.courses)
          : await certificateApi.get(data.termId);
      if (!certificate) {
        // Issuing is idempotent (retries preserve the same certificate and token), so asking
        // for it here rather than requiring a prior visit to a separate page is safe.
        await certificateApi.issue(data.termId);
        certificate = await certificateApi.get(data.termId);
      }
      if (!certificate) {
        throw new Error(
          "Your certificate isn't ready yet. It becomes available once your enrollment is officially final.",
        );
      }
      const qrDataUrl = await getVerificationQrDataUrl(certificate.verificationUrl);
      const html = buildCorPrintHtml({
        certificate,
        maxUnitsAllowed: data.effectiveCeiling,
        address: profile.data?.personalInfo.homeAddress?.trim() || FALLBACK_ADDRESS,
        contactNo: profile.data?.personalInfo.phoneNumber?.trim() || FALLBACK_CONTACT,
        qrDataUrl,
      });
      await downloadCertificatePdf(
        html,
        `COR_${certificate.studentNumber.replace(/[^A-Za-z0-9-]/g, "_")}.pdf`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "We couldn't prepare your certificate. Try again.",
      );
    } finally {
      // The print dialog has already been shown (or the attempt has already failed) by the time
      // the call above settles, so the button's busy state ends here either way.
      setPrinting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => {
          if (!printing) void handleClick();
        }}
        aria-label="Download Certificate of Registration (COR)"
        aria-busy={printing}
        className="inline-flex h-10 min-w-[280px] shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#7B1113] px-4 text-sm font-medium text-white transition-colors hover:bg-[#630e10] focus-visible:ring-2 focus-visible:ring-[#7B1113] focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {printing ? <Spinner /> : <DownloadIcon />}
        {printing ? "Preparing COR..." : "Download Certificate of Registration (COR)"}
      </button>
      {!isCorFinal && (
        <p
          id="cor-not-final-caption"
          className="mt-1.5 block text-right text-xs font-medium text-red-600"
        >
          Certificate enrollment is not final.
        </p>
      )}
      {error && (
        <p role="alert" className="max-w-xs text-right text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function EnrolledCompletionPanel({
  data,
  result,
  title = "You are officially enrolled.",
}: {
  data: EnrollmentEligibility;
  result: EnrollmentResult | null | undefined;
  title?: string;
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
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-neutral-500">{activeTermLabel(data)}</p>
          </div>
        </div>

        <DownloadCorButton data={data} result={result} />
      </div>

      {data.qualifiedForFreeHigherEducation && (
        <div className="mt-6 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          <InfoIcon />
          You are qualified for Free Higher Education Act (RA 10931)
        </div>
      )}

      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <dt className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Section
          </dt>
          <dd className="mt-1 text-lg font-bold text-neutral-900">
            {data.enrollmentSection ?? "TBA"}
          </dd>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <dt className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Allowed Units
          </dt>
          <dd className="mt-1 text-lg font-bold text-neutral-900 tabular-nums">
            {data.effectiveCeiling.toFixed(0)} units
          </dd>
        </div>
      </dl>

      {result && result.sections.length > 0 && <EnrolledSectionsTable result={result} />}
    </section>
  );
}

/** US-ENRL-001: pick sections, watch the running total against the real limit, then submit. */
export function EnrollmentPage() {
  const eligibility = useEligibility();
  const data = eligibility.data;
  const alreadyEnrolled = isAlreadyEnrolled(data);
  const coursesEnabled = Boolean(
    data?.isEligible && data.academicPeriod.isOpen && !alreadyEnrolled,
  );
  const courses = useAvailableCourses(data?.term, coursesEnabled);
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
  // an existing enrollment first, then a closed period, then a blocking hold, then any other
  // ineligibility, else the picker.
  const blockingHold = data?.holds.find((hold) => hold.isBlocking);
  const showEnrolled = Boolean(data && alreadyEnrolled);
  const showPeriodClosed = Boolean(data && !showEnrolled && !data.academicPeriod.isOpen);
  const showHolds = Boolean(
    data && !showEnrolled && !showPeriodClosed && !data.isEligible && blockingHold,
  );
  const showIneligible = Boolean(
    data && !showEnrolled && !showPeriodClosed && !showHolds && !data.isEligible,
  );
  const showPicker = Boolean(
    data && !showEnrolled && data.isEligible && data.academicPeriod.isOpen,
  );

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
                  Next Enrollment Date
                </dt>
                <dd className="text-brand-ink mt-1 font-bold">{nextEnrollmentDate(data)}</dd>
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

            {showEnrolled && (
              <EnrolledCompletionPanel data={data} result={data.currentEnrollment} />
            )}
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
              <EnrolledCompletionPanel data={data} result={submit.data} title="You're enrolled" />
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
