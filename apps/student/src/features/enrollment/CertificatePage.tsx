import { ApiError } from "@cbpupsis/shared/api";
import { unmetItems, type Certificate } from "@cbpupsis/shared/enrollment";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import "@cbpupsis/account/styles.css";
import { formatTimeRange } from "../../lib/datetime";
import { formatPeso } from "../../lib/money";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import {
  certificateErrorMessage,
  certificateStatusLabel,
  issuedOn,
  termName,
  unmetLabel,
} from "./certificateDisplay";
import { WEEKDAYS } from "./enrollmentDisplay";
import {
  isReadyToIssue,
  useCertificate,
  useDownloadCertificate,
  useIssueCertificate,
} from "./useCertificate";
import { currentTermOf, useEligibility } from "./useEnrollment";
import "./certificatePrint.css";

const card = "border-brand-border/25 rounded-2xl border bg-white p-6 shadow-sm";
const primaryButton =
  "bg-brand-crimson hover:bg-brand-crimson-dark inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-60";
const secondaryButton =
  "border-brand-border/40 text-brand-ink inline-flex min-h-11 items-center justify-center rounded-xl border bg-white px-5 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-60";
const th = "px-3 py-2.5 text-left text-xs font-semibold tracking-wide uppercase";
const td = "px-3 py-2.5 align-top text-sm";

function Loading() {
  return (
    <div className={card}>
      <p role="status" className="text-brand-muted text-sm">
        Loading your Certificate of Registration
      </p>
    </div>
  );
}

/** A refusal or failure in words, with what to do next (AC-ENRL-003.5, .6). */
function Problem({
  title,
  children,
  onRetry,
}: {
  title: string;
  children?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className={card}>
      <h2 className="text-brand-ink text-lg font-bold">{title}</h2>
      {children}
      {onRetry && (
        <button type="button" onClick={onRetry} className={`${primaryButton} mt-4`}>
          Try again
        </button>
      )}
    </div>
  );
}

function RefusalPanel({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (error instanceof ApiError && error.code === "COR_NOT_ENROLLED") {
    return (
      <Problem title="You are not enrolled this term">
        <p className="text-brand-muted mt-2 text-sm">
          A certificate is made once you enroll.{" "}
          <Link to="/enrollment" className="text-brand-crimson font-semibold underline">
            Go to Enrollment
          </Link>
        </p>
      </Problem>
    );
  }
  if (error instanceof ApiError && error.code === "COR_ENROLLMENT_NOT_FINAL") {
    return (
      <Problem title="Your enrollment is not final yet">
        <ul className="text-brand-muted mt-2 list-disc space-y-1 pl-5 text-sm">
          {unmetItems(error.details).map((item) => (
            <li key={item}>{unmetLabel(item)}</li>
          ))}
        </ul>
      </Problem>
    );
  }
  return (
    <Problem title="We could not load your certificate" onRetry={onRetry}>
      <p className="text-brand-muted mt-2 text-sm">{certificateErrorMessage(error)}</p>
    </Problem>
  );
}

/** ENROLLED_PENDING with nothing unmet: the certificate is one click away (AC-ENRL-003.9). */
function IssuePanel({ termId }: { termId: string }) {
  const issue = useIssueCertificate(termId);
  return (
    <div className={card}>
      <h2 className="text-brand-ink text-lg font-bold">Your certificate is ready to be made</h2>
      <p className="text-brand-muted mt-2 text-sm">
        Your enrollment is recorded. Get your Certificate of Registration to preview, download, and
        print it.
      </p>
      <button
        type="button"
        disabled={issue.isPending}
        aria-busy={issue.isPending}
        onClick={() => issue.mutate()}
        className={`${primaryButton} mt-4`}
      >
        {issue.isPending ? "Making your certificate..." : "Get my certificate"}
      </button>
      {issue.isError && (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {certificateErrorMessage(issue.error)}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-brand-muted text-xs font-semibold tracking-wide uppercase">{label}</dt>
      <dd className="text-brand-ink mt-1 font-bold break-words">{value}</dd>
    </div>
  );
}

function CourseTable({ certificate }: { certificate: Certificate }) {
  if (certificate.courses.length === 0) {
    return <p className="text-brand-muted text-sm">No courses are listed on this certificate.</p>;
  }
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region (WCAG 2.1.1)
    <div role="region" aria-label="Enrolled courses" tabIndex={0} className="overflow-x-auto">
      <table className="cor-courses-table w-full min-w-[44rem] border-collapse">
        <caption className="sr-only">Courses on your Certificate of Registration</caption>
        <thead className="bg-brand-maroon text-white">
          <tr>
            <th scope="col" className={th}>
              Course Code
            </th>
            <th scope="col" className={th}>
              Course Title
            </th>
            <th scope="col" className={th}>
              Section
            </th>
            <th scope="col" className={th}>
              Schedule
            </th>
            <th scope="col" className={th}>
              Room
            </th>
            <th scope="col" className={th}>
              Faculty
            </th>
            <th scope="col" className={`${th} text-right`}>
              Units
            </th>
          </tr>
        </thead>
        <tbody className="divide-brand-border/20 divide-y">
          {certificate.courses.map((course) => (
            <tr key={course.sectionId}>
              <th scope="row" className={`${td} text-brand-maroon text-left font-bold`}>
                {course.code}
              </th>
              <td className={td}>{course.title}</td>
              <td className={td}>{course.section}</td>
              <td className={td}>
                {course.schedule.length === 0 ? (
                  "To be announced"
                ) : (
                  <ul className="space-y-0.5">
                    {course.schedule.map((meeting) => (
                      <li
                        key={`${meeting.dayOfWeek}-${meeting.startTime}`}
                        className="whitespace-nowrap"
                      >
                        <span className="inline-block w-9 font-semibold">
                          {WEEKDAYS[meeting.dayOfWeek] ?? ""}
                        </span>
                        {formatTimeRange(meeting.startTime, meeting.endTime)}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className={td}>{course.room ?? "To be announced"}</td>
              <td className={td}>{course.faculty ?? "To be announced"}</td>
              <td className={`${td} text-right tabular-nums`}>{course.units.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={6} className={`${td} text-right font-bold`}>
              Total units
            </th>
            <td className={`${td} text-right font-bold tabular-nums`}>
              {certificate.totalUnits.toFixed(1)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Amount assessed, the Free Higher Education subsidy, and what is left to pay (AC-ENRL-003.2). */
function AssessmentPanel({ certificate }: { certificate: Certificate }) {
  const { assessment } = certificate;
  return (
    <section aria-labelledby="assessment-heading" className="mt-6">
      <h3 id="assessment-heading" className="text-brand-ink text-base font-bold">
        Assessment
      </h3>
      <dl className="mt-3 grid max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
        <dt>Amount assessed</dt>
        <dd className="text-right tabular-nums">{formatPeso(assessment.amountAssessed)}</dd>
        <dt>Free Higher Education subsidy</dt>
        <dd className="text-right tabular-nums">{formatPeso(assessment.subsidyApplied)}</dd>
        <dt className="font-bold">Net payable</dt>
        <dd className="text-right font-bold tabular-nums">{formatPeso(assessment.netPayable)}</dd>
      </dl>
      {assessment.fheQualified && !assessment.fheForfeited && (
        <p className="mt-3 text-sm font-medium text-emerald-900">
          You qualify for free higher education under RA 10931.
        </p>
      )}
      {assessment.fheForfeited && (
        <p className="mt-3 text-sm text-amber-900">
          Free higher education does not apply this term
          {assessment.fheForfeitureReason ? `: ${assessment.fheForfeitureReason}` : "."}
        </p>
      )}
    </section>
  );
}

function DownloadButton({ termId }: { termId: string }) {
  const download = useDownloadCertificate(termId);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={download.isPending}
        aria-busy={download.isPending}
        onClick={() => download.mutate()}
        className={primaryButton}
      >
        {download.isPending ? "Downloading PDF..." : "Download PDF"}
      </button>
      <p role="status" className="sr-only">
        {download.isPending ? "Downloading your certificate" : ""}
      </p>
      {download.isError && (
        <p role="alert" className="text-sm text-red-800">
          {certificateErrorMessage(download.error)}
        </p>
      )}
    </div>
  );
}

function CertificatePreview({ certificate }: { certificate: Certificate }) {
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row print:hidden">
        <DownloadButton termId={certificate.term.id} />
        <button type="button" onClick={() => window.print()} className={secondaryButton}>
          Print
        </button>
      </div>

      <article aria-labelledby="cor-heading" className={`${card} cor-sheet`}>
        <h2 id="cor-heading" className="text-brand-maroon text-xl font-bold">
          Certificate of Registration
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Name" value={certificate.name} />
          <Stat label="Student Number" value={certificate.studentNumber} />
          <Stat label="Program" value={certificate.program} />
          <Stat label="Term" value={termName(certificate.term)} />
          <Stat label="Date Issued" value={issuedOn(certificate.issuedAt)} />
          <Stat label="Status" value={certificateStatusLabel(certificate.status)} />
        </dl>

        <h3 className="text-brand-ink mt-6 mb-3 text-base font-bold">Enrolled Courses</h3>
        <CourseTable certificate={certificate} />
        <AssessmentPanel certificate={certificate} />

        <p className="text-brand-muted mt-6 text-xs break-all">
          Check this certificate at {certificate.verificationUrl}
        </p>
      </article>
    </>
  );
}

/** US-ENRL-003: issue, preview, download, and print the Certificate of Registration. */
export function CertificatePage() {
  // Eligibility names the current term; its academicTermId selects the certificate.
  const currentTerm = useEligibility();
  const termId = currentTermOf(currentTerm.data)?.id;
  const certificate = useCertificate(termId);

  function body() {
    if (currentTerm.isPending) return <Loading />;
    if (currentTerm.isError) {
      return (
        <Problem
          title="We could not load the current term"
          onRetry={() => void currentTerm.refetch()}
        >
          <p className="text-brand-muted mt-2 text-sm">
            {certificateErrorMessage(currentTerm.error)}
          </p>
        </Problem>
      );
    }
    if (!termId) {
      return (
        <div className={card}>
          <p className="text-brand-muted text-sm">
            No term is set up yet, so there is no certificate to show.
          </p>
        </div>
      );
    }
    if (certificate.isPending) return <Loading />;
    if (certificate.isError) {
      return isReadyToIssue(certificate.error) ? (
        <IssuePanel termId={termId} />
      ) : (
        <RefusalPanel error={certificate.error} onRetry={() => void certificate.refetch()} />
      );
    }
    return <CertificatePreview certificate={certificate.data} />;
  }

  return (
    <DashboardLayout>
      <div data-cor-page className="space-y-6 px-4 py-8 sm:px-8">
        <nav aria-label="Breadcrumb" className="print:hidden">
          <ol className="text-brand-muted flex flex-wrap items-center gap-1.5 text-sm">
            <li>Academics</li>
            <li aria-hidden="true">&gt;</li>
            <li>
              <Link to="/enrollment" className="hover:underline">
                Enrollment
              </Link>
            </li>
            <li aria-hidden="true">&gt;</li>
            <li aria-current="page" className="text-brand-ink font-semibold">
              Certificate of Registration
            </li>
          </ol>
        </nav>

        <h1 className="text-brand-maroon text-3xl font-bold tracking-tight sm:text-4xl print:hidden">
          Certificate of Registration
        </h1>

        {body()}
      </div>
    </DashboardLayout>
  );
}
