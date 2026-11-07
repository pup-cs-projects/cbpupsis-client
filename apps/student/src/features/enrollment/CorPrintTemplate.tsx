import type { Certificate, CertificateCourse } from "@cbpupsis/shared/enrollment";
import { qrCodeDataUrl } from "@cbpupsis/ui";

import { formatTimeRange } from "../../lib/datetime";
import {
  assessmentLabel,
  CAMPUS,
  programCode,
  sectionLabel,
  semesterLabel,
  YEAR_LEVEL,
} from "./corDisplay";
import { WEEKDAYS } from "./enrollmentDisplay";

export interface CorPrintData {
  certificate: Certificate;
  maxUnitsAllowed: number;
  address: string;
  contactNo: string;
  /** A data: URL (see `getVerificationQrDataUrl`). Omitted, the QR box prints empty. */
  qrDataUrl?: string;
}

/** The COR's real verification QR, as a PNG data URL — resolve this before `buildCorPrintHtml`,
 * since building the HTML document itself is synchronous. */
export function getVerificationQrDataUrl(verificationUrl: string): Promise<string> {
  return qrCodeDataUrl(verificationUrl, { width: 120 });
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function courseRowHtml(course: CertificateCourse): string {
  const schedule = course.schedule
    .map((meeting) => {
      const day = WEEKDAYS[meeting.dayOfWeek] ?? "—";
      const time = formatTimeRange(meeting.startTime, meeting.endTime);
      const room = meeting.room ? ` &middot; ${esc(meeting.room)}` : "";
      return `<div class="cor-meeting"><span class="cor-day">${day}</span> ${time} ${esc(meeting.type)}${room}</div>`;
    })
    .join("");
  // The data model doesn't split tuition units from credited units, or carry a per-course fee
  // breakdown; one unit figure serves both columns, and every row reads "Not Applicable".
  return `
    <tr>
      <td class="bold">${esc(course.code)}</td>
      <td>${esc(course.title)}</td>
      <td class="text-center">${esc(course.section)}</td>
      <td class="text-center">${course.units.toFixed(1)}</td>
      <td class="text-center">${course.units.toFixed(1)}</td>
      <td>${schedule}</td>
      <td class="text-center">Not Applicable</td>
      <td class="text-right">Php 0.00</td>
    </tr>`;
}

/** The full standalone COR document as one HTML string for the client-side PDF renderer. It
 * carries every style inline, since no app stylesheet reaches the transient export iframe. */
export function buildCorPrintHtml(data: CorPrintData): string {
  const { certificate, maxUnitsAllowed, address, contactNo, qrDataUrl } = data;
  const rows = certificate.courses.map(courseRowHtml).join("");
  const totalUnits = certificate.totalUnits.toFixed(1);
  const qrImg = qrDataUrl
    ? `<img src="${qrDataUrl}" width="90" height="90" alt="Scan to verify this certificate" />`
    : `<div class="cor-qr-placeholder" aria-hidden="true"></div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Certificate of Registration — ${esc(certificate.studentNumber)}</title>
<style>
  @page { size: landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; width: 281mm; min-height: 194mm; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    font-size: 9px;
    line-height: 1.28;
  }
  .cor-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }
  .cor-seal-block { display: flex; align-items: center; gap: 8px; min-width: 390px; }
  .cor-seal { width: 56px; height: 56px; object-fit: contain; }
  .cor-seal-text p { margin: 0; line-height: 1.3; font-size: 11px; }
  .cor-seal-text .bold { font-weight: 700; }
  .cor-title-box {
    border: 1px solid #000;
    padding: 8px 18px;
    text-align: center;
    font-weight: 700;
    font-size: 15px;
    letter-spacing: 0.25px;
    align-self: center;
    white-space: nowrap;
  }
  .cor-qr-block { text-align: center; width: 92px; }
  .cor-qr-block img, .cor-qr-placeholder { width: 82px; height: 82px; }
  .cor-qr-placeholder { border: 1px solid #000; }
  .cor-qr-block p { margin: 2px 0 0; font-size: 8px; color: #444; }
  .cor-student { display:flex; justify-content:space-between; align-items:end; margin: 9px 0 6px; font-size: 11px; font-weight: 700; }
  .cor-student-name, .cor-student-number { display:block; font-size: 13px; }
  .cor-student-number { margin-top: 1px; }
  .cor-term { display:flex; gap: 38px; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 9px; }
  .cor-details-table { border: 1px solid #000; }
  .cor-details-table td { border: 1px solid #000; padding: 5px 6px; vertical-align: top; }
  .cor-courses-table { border: 1px solid #000; table-layout: fixed; margin-top: 6px; }
  .cor-courses-table th, .cor-courses-table td { border: none; padding: 5px 6px; vertical-align: top; }
  .cor-courses-table thead th {
    text-transform: uppercase;
    font-size: 8px;
    text-align: center;
    border-bottom: 1px solid #000;
  }
  .cor-courses-table tbody tr, .cor-details-table tr { page-break-inside: avoid; }
  .cor-courses-table tbody td:nth-child(7), .cor-courses-table tbody td:nth-child(8) { text-align: right; }
  .cor-meeting { white-space: nowrap; }
  .cor-day { display: inline-block; width: 12px; font-weight: 700; }
  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .bold { font-weight: 700; }
  .cor-terminator { text-align: center; font-weight: 700; letter-spacing: .45px; padding: 8px 0 10px !important; }
  .cor-spacer td { height: 42mm; padding: 0 !important; }
  .cor-summary-area { border-top: 1px solid #000; padding: 0 !important; }
  .cor-summary-grid { display:grid; grid-template-columns: 1.1fr 1fr 1fr; }
  .cor-summary-grid > div { min-height: 25px; display:flex; align-items:center; gap:6px; padding:5px 7px; border-right:1px solid #000; font-weight:700; }
  .cor-summary-grid > div:last-child { border-right:none; }
  .cor-summary-grid .summary-value { margin-left:auto; }
  .cor-sub-footer { display:flex; justify-content:space-between; border-top: 1px solid #000; padding:4px 7px; font-weight:700; }
  .cor-footer { margin-top: 7px; font-size: 9px; text-align:center; }
  .cor-warning { color: #c40000; font-weight: 700; margin: 0 auto; max-width: 610px; }
  @media print {
    .cor-courses-table thead { display: table-header-group; }
  }
</style>
</head>
<body>
  <div class="cor-header">
    <div class="cor-seal-block">
      <img class="cor-seal" src="/favicon-32.png" alt="Polytechnic University of the Philippines seal" />
      <div class="cor-seal-text">
        <p>Republic of the Philippines</p>
        <p class="bold">POLYTECHNIC UNIVERSITY OF THE PHILIPPINES</p>
        <p>${CAMPUS}</p>
      </div>
    </div>
    <div class="cor-title-box">CERTIFICATE OF REGISTRATION</div>
    <div class="cor-qr-block">
      ${qrImg}
      <p>Scan to verify</p>
    </div>
  </div>

  <div class="cor-student">
    <div>
      <span class="cor-student-name">${esc(certificate.name)}</span>
      <span class="cor-student-number">${esc(certificate.studentNumber)}</span>
    </div>
    <div class="cor-term">
      <span>A.Y.: &nbsp;&nbsp; ${esc(certificate.term.year)}</span>
      <span>TERM: &nbsp; ${esc(semesterLabel(certificate.term.semester))}</span>
    </div>
  </div>

  <table class="cor-details-table">
    <tbody>
      <tr>
        <td colspan="2"><span class="bold">Program Description: </span>${esc(certificate.program)}</td>
        <td><span class="bold">Program Code: </span>${esc(programCode(certificate.program))}</td>
      </tr>
      <tr>
        <td><span class="bold">Campus: </span>${CAMPUS}</td>
        <td><span class="bold">Year Level: </span>${YEAR_LEVEL}</td>
        <td><span class="bold">Section: </span>${esc(sectionLabel(certificate))}</td>
      </tr>
      <tr>
        <td colspan="2"><span class="bold">Address: </span>${esc(address)}</td>
        <td><span class="bold">Contact No: </span>${esc(contactNo)}</td>
      </tr>
    </tbody>
  </table>

  <table class="cor-courses-table">
    <colgroup>
      <col style="width:7%" />
      <col style="width:31%" />
      <col style="width:11%" />
      <col style="width:5%" />
      <col style="width:5%" />
      <col style="width:22%" />
      <col style="width:13%" />
      <col style="width:6%" />
    </colgroup>
    <thead>
      <tr>
        <th>Subject Code</th>
        <th>Subject Title</th>
        <th>Section Code</th>
        <th>Tuition Units</th>
        <th>Credited Units</th>
        <th>Schedule</th>
        <th>Breakdown of Fees</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr><td colspan="8" class="cor-terminator">x - x - x - x - x - Nothing Follows - x - x - x - x - x</td></tr>
      <tr class="cor-spacer"><td colspan="8"></td></tr>
    </tbody>
    <tfoot>
      <tr>
        <td colspan="8" class="cor-summary-area">
          <div class="cor-summary-grid">
            <div><span>MAX UNITS ALLOWED:</span><span class="summary-value">${maxUnitsAllowed.toFixed(1)}</span></div>
            <div><span>TOTAL UNITS ENROLLED:</span><span class="summary-value">${totalUnits} (Tuition) | ${totalUnits} (Credited)</span></div>
            <div><span>TOTAL ASSESSMENT:</span><span class="summary-value">${esc(assessmentLabel(certificate.assessment))}</span></div>
          </div>
          <div class="cor-sub-footer"><span>REGISTRAR:</span><span>This is system-generated, signature is not required.</span></div>
        </td>
      </tr>
    </tfoot>
  </table>

  <div class="cor-footer">
    <p class="cor-warning">
      This document contains personal-identifiable information that is subject to Data Privacy.
      Please keep this document protected and in a safe place.
    </p>
  </div>
</body>
</html>`;
}
