import type { Certificate, CertificateCourse } from "@cbpupsis/shared/enrollment";
import { ErrorAlert, QrCode } from "@cbpupsis/ui";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import "@cbpupsis/account/styles.css";
import { downloadCertificatePdf } from "../../lib/downloadCertificatePdf";
import { formatTimeRange } from "../../lib/datetime";
import { useStudentProfile } from "../profile/useStudentProfile";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import {
  assessmentLabel,
  CAMPUS,
  FALLBACK_ADDRESS,
  FALLBACK_CONTACT,
  programCode,
  sectionLabel,
  semesterLabel,
  YEAR_LEVEL,
} from "./corDisplay";
import { WEEKDAYS } from "./enrollmentDisplay";
import { useEligibility } from "./useEnrollment";
import { useCertificate, useIssueCertificate } from "./useCertificate";
import { buildCorPrintHtml, getVerificationQrDataUrl } from "./CorPrintTemplate";
import "./printCertificate.css";

const PrinterIcon = () => (
  <svg
    className="size-4 shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

function PupSeal() {
  return (
    <img
      src="/favicon-32.png"
      alt="Polytechnic University of the Philippines seal"
      className="size-14 shrink-0 object-contain"
      width={56}
      height={56}
      loading="eager"
      decoding="sync"
    />
  );
}

function Loading() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <p role="status" className="sr-only">
        Loading your Certificate of Registration
      </p>
      <div className="bg-brand-skeleton/25 h-24 animate-pulse rounded-2xl motion-reduce:animate-none" />
      <div className="bg-brand-skeleton/25 h-[32rem] animate-pulse rounded-2xl motion-reduce:animate-none" />
    </div>
  );
}

/** Where "View your Certificate of Registration" leads once it is final (US-ENRL-003, issue #43):
 * not yet issued and not final, or no enrollment at all, show the same waiting message. */
function NotAvailableYet() {
  return (
    <div className="space-y-4 px-4 py-8 text-center sm:px-8">
      <h1 className="text-brand-maroon text-2xl font-bold">Certificate of Registration</h1>
      <p className="text-brand-muted mx-auto max-w-md text-sm">
        Your certificate isn&apos;t ready yet. It becomes available once your enrollment is
        officially final.
      </p>
      <Link
        to="/enrollment"
        className="text-brand-crimson inline-flex min-h-11 items-center text-sm font-semibold hover:underline"
      >
        Back to Enrollment
      </Link>
    </div>
  );
}

function CourseRow({ course }: { course: CertificateCourse }) {
  return (
    <tr>
      <th
        scope="row"
        className="cor-td border border-black/40 px-2 py-2 text-left align-top font-bold"
      >
        {course.code}
      </th>
      <td className="cor-td border border-black/40 px-2 py-2 align-top">{course.title}</td>
      <td className="cor-td border border-black/40 px-2 py-2 text-center align-top">
        {course.section}
      </td>
      <td className="cor-td border border-black/40 px-2 py-2 text-center align-top tabular-nums">
        {course.units.toFixed(1)}
      </td>
      {/* The data model doesn't yet split tuition units from credited units; one figure serves
          both until it does. */}
      <td className="cor-td border border-black/40 px-2 py-2 text-center align-top tabular-nums">
        {course.units.toFixed(1)}
      </td>
      <td className="cor-td border border-black/40 px-2 py-2 align-top">
        <ul className="space-y-1">
          {course.schedule.map((meeting) => (
            <li key={`${meeting.dayOfWeek}-${meeting.startTime}`} className="whitespace-nowrap">
              <span className="inline-block w-9 font-semibold">
                {WEEKDAYS[meeting.dayOfWeek] ?? "—"}
              </span>
              <span className="tabular-nums">
                {formatTimeRange(meeting.startTime, meeting.endTime)}
              </span>
              {meeting.room && <span className="text-brand-muted"> &middot; {meeting.room}</span>}
            </li>
          ))}
        </ul>
      </td>
      {/* No per-course fee breakdown exists in the data model; every assessed fee is a term-level
          line, summarized in the totals below instead. */}
      <td className="cor-td border border-black/40 px-2 py-2 text-center align-top">
        Not Applicable
      </td>
      <td className="cor-td border border-black/40 px-2 py-2 text-right align-top tabular-nums">
        Php 0.00
      </td>
    </tr>
  );
}

function CertificateSheet({
  certificate,
  maxUnitsAllowed,
  address,
  contactNo,
}: {
  certificate: Certificate;
  maxUnitsAllowed: number;
  address: string;
  contactNo: string;
}) {
  const totalUnits = certificate.totalUnits;
  const section = sectionLabel(certificate);

  return (
    <div className="cor-sheet space-y-5 rounded-2xl border border-black/20 bg-white p-6 shadow-sm sm:p-8">
      <div className="cor-header grid grid-cols-[auto_1fr_auto] items-start gap-4">
        <div className="flex items-start gap-3">
          <PupSeal />
          <div className="text-[11px] leading-tight text-black">
            <p>Republic of the Philippines</p>
            <p className="font-bold">POLYTECHNIC UNIVERSITY OF THE PHILIPPINES</p>
            <p>{CAMPUS}</p>
          </div>
        </div>

        <div className="cor-title-box flex items-center justify-center rounded border-2 border-black px-4 py-3 text-center text-base font-bold tracking-wide text-black sm:text-lg">
          CERTIFICATE OF REGISTRATION
        </div>

        <div className="flex flex-col items-center gap-1">
          <QrCode value={certificate.verificationUrl} label="Scan to verify this certificate" />
          <p className="text-brand-muted text-center text-[10px]">Scan to verify</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-black sm:grid-cols-4">
        <div>
          <dt className="font-semibold">Student Name</dt>
          <dd>{certificate.name}</dd>
        </div>
        <div>
          <dt className="font-semibold">Student Number</dt>
          <dd>{certificate.studentNumber}</dd>
        </div>
        <div>
          <dt className="font-semibold">A.Y.</dt>
          <dd>{certificate.term.year}</dd>
        </div>
        <div>
          <dt className="font-semibold">Term</dt>
          <dd>{semesterLabel(certificate.term.semester)}</dd>
        </div>
      </dl>

      <table className="cor-details-table w-full border-collapse text-xs text-black">
        <tbody>
          <tr>
            <td className="cor-details-td border border-black/40 px-3 py-2 align-top" colSpan={2}>
              <span className="font-semibold">Program Description: </span>
              {certificate.program}
            </td>
            <td className="cor-details-td border border-black/40 px-3 py-2 align-top">
              <span className="font-semibold">Program Code: </span>
              {programCode(certificate.program)}
            </td>
          </tr>
          <tr>
            <td className="cor-details-td border border-black/40 px-3 py-2 align-top">
              <span className="font-semibold">Campus: </span>
              {CAMPUS}
            </td>
            <td className="cor-details-td border border-black/40 px-3 py-2 align-top">
              <span className="font-semibold">Year Level: </span>
              {YEAR_LEVEL}
            </td>
            <td className="cor-details-td border border-black/40 px-3 py-2 align-top">
              <span className="font-semibold">Section: </span>
              {section}
            </td>
          </tr>
          <tr>
            <td className="cor-details-td border border-black/40 px-3 py-2 align-top" colSpan={2}>
              <span className="font-semibold">Address: </span>
              {address}
            </td>
            <td className="cor-details-td border border-black/40 px-3 py-2 align-top">
              <span className="font-semibold">Contact No: </span>
              {contactNo}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="overflow-x-auto">
        <table className="cor-courses-table w-full min-w-[42rem] border-collapse text-xs text-black">
          <thead>
            <tr>
              <th className="cor-th border border-black/70 bg-black/5 px-2 py-2 text-left text-[10px] font-semibold tracking-wide uppercase">
                Subject Code
              </th>
              <th className="cor-th border border-black/70 bg-black/5 px-2 py-2 text-left text-[10px] font-semibold tracking-wide uppercase">
                Subject Title
              </th>
              <th className="cor-th border border-black/70 bg-black/5 px-2 py-2 text-left text-[10px] font-semibold tracking-wide uppercase">
                Section Code
              </th>
              <th className="cor-th border border-black/70 bg-black/5 px-2 py-2 text-left text-[10px] font-semibold tracking-wide uppercase">
                Tuition Units
              </th>
              <th className="cor-th border border-black/70 bg-black/5 px-2 py-2 text-left text-[10px] font-semibold tracking-wide uppercase">
                Credited Units
              </th>
              <th className="cor-th border border-black/70 bg-black/5 px-2 py-2 text-left text-[10px] font-semibold tracking-wide uppercase">
                Schedule
              </th>
              <th className="cor-th border border-black/70 bg-black/5 px-2 py-2 text-left text-[10px] font-semibold tracking-wide uppercase">
                Breakdown of Fees
              </th>
              <th className="cor-th border border-black/70 bg-black/5 px-2 py-2 text-left text-[10px] font-semibold tracking-wide uppercase">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {certificate.courses.map((course) => (
              <CourseRow key={course.sectionId} course={course} />
            ))}
            <tr>
              <td
                colSpan={8}
                className="cor-td border border-black/40 px-2 py-2 text-center align-top font-semibold tracking-wide"
              >
                x - x - x - x - x - Nothing Follows - x - x - x - x - x
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={5}
                className="cor-td border border-black/40 px-2 py-2 text-right align-top font-semibold"
              >
                MAX UNITS ALLOWED
              </td>
              <td
                colSpan={3}
                className="cor-td border border-black/40 px-2 py-2 align-top tabular-nums"
              >
                {maxUnitsAllowed.toFixed(1)}
              </td>
            </tr>
            <tr>
              <td
                colSpan={5}
                className="cor-td border border-black/40 px-2 py-2 text-right align-top font-semibold"
              >
                TOTAL UNITS ENROLLED (Tuition | Credited)
              </td>
              <td
                colSpan={3}
                className="cor-td border border-black/40 px-2 py-2 align-top tabular-nums"
              >
                {totalUnits.toFixed(1)} | {totalUnits.toFixed(1)}
              </td>
            </tr>
            <tr>
              <td
                colSpan={5}
                className="cor-td border border-black/40 px-2 py-2 text-right align-top font-semibold"
              >
                TOTAL ASSESSMENT
              </td>
              <td
                colSpan={3}
                className="cor-td border border-black/40 px-2 py-2 align-top font-semibold tabular-nums"
              >
                {assessmentLabel(certificate.assessment)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="cor-footer space-y-2 text-xs text-black">
        <p>This is system-generated, signature is not required.</p>
        <p className="cor-footer-warning font-semibold text-red-700">
          This document contains personal-identifiable information that is subject to Data Privacy.
          Please keep this document protected and in a safe place.
        </p>
      </div>
    </div>
  );
}

/** US-ENRL-003 (issue #43): the issued Certificate of Registration, viewable and printable. */
export function CertificateOfRegistration() {
  const eligibility = useEligibility();
  const termId = eligibility.data?.termId;
  const certificate = useCertificate(termId);
  const issue = useIssueCertificate(termId);
  const issuedForTerm = useRef<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Issuing is idempotent (retries preserve the same certificate and token), so once we learn
  // none exists yet for this term, ask for it automatically rather than making the student press
  // a button first.
  useEffect(() => {
    if (
      termId &&
      certificate.isSuccess &&
      certificate.data === null &&
      issuedForTerm.current !== termId
    ) {
      issuedForTerm.current = termId;
      issue.mutate();
    }
  }, [termId, certificate.isSuccess, certificate.data, issue]);

  const profile = useStudentProfile();
  const address = profile.data?.personalInfo.homeAddress?.trim() || FALLBACK_ADDRESS;
  const contactNo = profile.data?.personalInfo.phoneNumber?.trim() || FALLBACK_CONTACT;

  async function downloadPdf() {
    if (!certificate.data || downloading) return;
    setDownloading(true);
    try {
      const qrDataUrl = await getVerificationQrDataUrl(certificate.data.verificationUrl);
      const html = buildCorPrintHtml({
        certificate: certificate.data,
        maxUnitsAllowed: eligibility.data?.effectiveCeiling ?? 18,
        address,
        contactNo,
        qrDataUrl,
      });
      await downloadCertificatePdf(
        html,
        `COR_${certificate.data.studentNumber.replace(/[^A-Za-z0-9-]/g, "_")}.pdf`,
      );
    } finally {
      setDownloading(false);
    }
  }

  const loading =
    !eligibility.isError &&
    (eligibility.isPending ||
      certificate.isPending ||
      (certificate.data === null && !issue.isError));
  const notAvailable = certificate.data === null && issue.isError;

  return (
    <DashboardLayout>
      {eligibility.isError && <ErrorAlert error={eligibility.error} />}
      {certificate.isError && (
        <ErrorAlert error={certificate.error} onRetry={() => void certificate.refetch()} />
      )}

      <div data-cor-page className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-8">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <Link
            to="/enrollment"
            className="text-brand-crimson inline-flex min-h-11 items-center text-sm font-semibold hover:underline"
          >
            ← Back to Enrollment
          </Link>
          {certificate.data && (
            <button
              type="button"
              onClick={() => void downloadPdf()}
              className="text-brand-ink flex h-10 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-medium transition-colors hover:bg-neutral-50"
            >
              <PrinterIcon />
              {downloading ? "Preparing PDF..." : "Download PDF"}
            </button>
          )}
        </div>

        {loading && <Loading />}
        {notAvailable && <NotAvailableYet />}
        {certificate.data && (
          <CertificateSheet
            certificate={certificate.data}
            maxUnitsAllowed={eligibility.data?.effectiveCeiling ?? 18}
            address={address}
            contactNo={contactNo}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
