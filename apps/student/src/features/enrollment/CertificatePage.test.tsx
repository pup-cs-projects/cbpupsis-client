import { mockApi } from "@cbpupsis/account/testing";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { expectNoA11yViolations } from "../../test/axe";
import { me, ME_ROUTE, signInDirectly } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";

const ELIGIBILITY_ROUTE = "GET /student/enrollment/eligibility";
const COR_ROUTE = "GET /student/schedule/cor";
const ISSUE_ROUTE = "POST /student/schedule/cor";
const TERM_ID = "00000000-0000-0000-0000-000000000001";

function eligibilityBody() {
  return {
    isEligible: true,
    term: "2026-2027-First Semester",
    academicTermId: TERM_ID,
    termType: "REGULAR",
    prescribedLoad: "18",
    approvedOverloadUnits: "0",
    standingReduction: "0",
    effectiveCeiling: "18",
    academicStanding: "Good Standing",
    overloadEligible: false,
    summerSubjectCap: null,
    holds: [],
    academicPeriod: { start: "2026-06-01T00:00:00Z", end: "2026-06-30T00:00:00Z", isOpen: true },
    reasons: [],
  };
}

function certificate(overrides: Record<string, unknown> = {}) {
  return {
    certificateId: "11111111-1111-1111-1111-111111111111",
    issuedAt: "2026-06-02T01:00:00Z",
    status: "CURRENT",
    name: "Juan Dela Cruz",
    studentNumber: "2021-00123-MN-0",
    program: "Bachelor of Science in Computer Science",
    term: { id: TERM_ID, year: "2026-2027", semester: "first" },
    courses: [
      {
        sectionId: "22222222-2222-2222-2222-222222222222",
        code: "COMP 016",
        title: "Web Development",
        section: "BSCS 3-1",
        schedule: [
          {
            dayOfWeek: 0,
            startTime: "13:30:00",
            endTime: "16:30:00",
            room: "S508",
            type: "Lecture",
          },
        ],
        room: "S508",
        faculty: "AJ San Luis",
        units: "3.0",
      },
    ],
    totalUnits: "3.0",
    assessment: {
      lines: [{ code: "TUITION", amount: "3000.00" }],
      amountAssessed: "3000.00",
      subsidyApplied: "3000.00",
      netPayable: "0.00",
      fheQualified: true,
      fheForfeited: false,
      fheForfeitureReason: null,
    },
    verificationUrl: "https://sis.example.test/verify/tok-1",
    ...overrides,
  };
}

const notFinal = (unmet: string[]) => ({
  status: 409,
  body: {
    code: "COR_ENROLLMENT_NOT_FINAL",
    message: "Certificate enrollment is not final.",
    details: { unmet },
  },
});

function openCertificate(routes: Parameters<typeof mockApi>[0] = {}) {
  signInDirectly();
  const api = mockApi({
    [ME_ROUTE]: { status: 200, body: me },
    [ELIGIBILITY_ROUTE]: { status: 200, body: eligibilityBody() },
    [COR_ROUTE]: { status: 200, body: certificate() },
    ...routes,
  });
  renderApp("/enrollment/certificate");
  return api;
}

/** The dd beside a dt with this label. */
function statValue(label: string) {
  return screen.getByText(label).nextElementSibling;
}

afterEach(() => {
  session.signOut();
  vi.unstubAllGlobals();
});

describe("CertificatePage (US-ENRL-003)", () => {
  it("AC-ENRL-003.1: previews the issued certificate: identity, term, and every course with its details", async () => {
    const api = openCertificate();

    expect(
      await screen.findByRole("heading", { name: "Certificate of Registration", level: 2 }),
    ).toBeInTheDocument();
    expect(statValue("Name")).toHaveTextContent("Juan Dela Cruz");
    expect(statValue("Student Number")).toHaveTextContent("2021-00123-MN-0");
    expect(statValue("Program")).toHaveTextContent("Bachelor of Science in Computer Science");
    expect(statValue("Term")).toHaveTextContent("2026-2027, First Semester");

    const row = screen.getByRole("rowheader", { name: "COMP 016" }).closest("tr") as HTMLElement;
    expect(within(row).getByText("Web Development")).toBeInTheDocument();
    expect(within(row).getByText("BSCS 3-1")).toBeInTheDocument();
    expect(within(row).getByText("S508")).toBeInTheDocument();
    expect(within(row).getByText("AJ San Luis")).toBeInTheDocument();
    expect(within(row).getByText("Mon")).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: "Total units" }).nextElementSibling,
    ).toHaveTextContent("3.0");
    // Read only: the preview never issues a certificate.
    expect(api.called(ISSUE_ROUTE)).toHaveLength(0);
  });

  it("AC-ENRL-003.2: shows the amount assessed, the subsidy, and a net payable of 0.00 for a qualified student", async () => {
    openCertificate();

    await screen.findByRole("heading", { name: "Assessment" });
    expect(statValue("Amount assessed")).toHaveTextContent("3,000.00");
    expect(statValue("Free Higher Education subsidy")).toHaveTextContent("3,000.00");
    expect(statValue("Net payable")).toHaveTextContent("0.00");
    expect(screen.getByText(/You qualify for free higher education/)).toBeInTheDocument();
  });

  it("AC-ENRL-003.9: an enrollment not issued yet offers 'Get my certificate', which issues once and then previews", async () => {
    const user = userEvent.setup();
    const api = openCertificate({
      [COR_ROUTE]: [notFinal([]), { status: 200, body: certificate() }],
      [ISSUE_ROUTE]: {
        status: 201,
        body: { certificateId: "c-1", issuedAt: "2026-06-02T01:00:00Z", status: "CURRENT" },
      },
    });

    await user.click(await screen.findByRole("button", { name: "Get my certificate" }));

    expect(await screen.findByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(api.called(ISSUE_ROUTE)).toHaveLength(1);
    expect(api.called(ISSUE_ROUTE)[0]?.body).toEqual({ academicTermId: TERM_ID });
  });

  it("AC-ENRL-003.9: the 'Get my certificate' button is disabled while sending", async () => {
    const user = userEvent.setup();
    openCertificate({ [COR_ROUTE]: notFinal([]), [ISSUE_ROUTE]: "pending" });

    await user.click(await screen.findByRole("button", { name: "Get my certificate" }));

    expect(
      await screen.findByRole("button", { name: "Making your certificate..." }),
    ).toBeDisabled();
  });

  it("AC-ENRL-003.1: Download PDF saves the API's PDF and shows progress", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:cor");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const api = openCertificate({
      [COR_ROUTE]: [
        { status: 200, body: certificate() },
        { status: 200, body: "%PDF-1.4", headers: { "Content-Type": "application/pdf" } },
      ],
    });

    await user.click(await screen.findByRole("button", { name: "Download PDF" }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    expect(api.called(COR_ROUTE)).toHaveLength(2);
  });

  it("AC-ENRL-003.1: Download PDF shows its progress while the file is on its way", async () => {
    const user = userEvent.setup();
    openCertificate({ [COR_ROUTE]: [{ status: 200, body: certificate() }, "pending"] });

    await user.click(await screen.findByRole("button", { name: "Download PDF" }));

    expect(await screen.findByRole("button", { name: "Downloading PDF..." })).toBeDisabled();
  });

  it("AC-ENRL-003.5: COR_NOT_ENROLLED says the student is not enrolled, with a link to enrollment", async () => {
    openCertificate({
      [COR_ROUTE]: {
        status: 409,
        body: { code: "COR_NOT_ENROLLED", message: "No enrollment exists for this term." },
      },
    });

    expect(
      await screen.findByRole("heading", { name: "You are not enrolled this term" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Enrollment" })).toHaveAttribute(
      "href",
      "/enrollment",
    );
  });

  it("AC-ENRL-003.6: COR_ENROLLMENT_NOT_FINAL names each unmet item", async () => {
    openCertificate({ [COR_ROUTE]: notFinal(["HOLD", "PREREQUISITE_VIOLATION", "NO_ASSESSMENT"]) });

    expect(
      await screen.findByRole("heading", { name: "Your enrollment is not final yet" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/You have a hold on your account/)).toBeInTheDocument();
    expect(screen.getByText(/needs a prerequisite you have not passed/)).toBeInTheDocument();
    expect(screen.getByText(/Your fees have not been assessed yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Get my certificate" })).not.toBeInTheDocument();
  });

  it("AC-ENRL-003.1: a 503 says the certificate could not be made, and retry works", async () => {
    const user = userEvent.setup();
    openCertificate({
      [COR_ROUTE]: [
        { status: 503, body: { code: "SERVICE_UNAVAILABLE", message: "Unavailable." } },
        { status: 200, body: certificate() },
      ],
    });

    expect(
      await screen.findByText("The certificate could not be made. Try again in 30 seconds."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Juan Dela Cruz")).toBeInTheDocument();
  });

  it("AC-ENRL-003.1: shows a loading message, then an empty message for a certificate with no courses", async () => {
    openCertificate({ [COR_ROUTE]: { status: 200, body: certificate({ courses: [] }) } });

    expect(await screen.findByText("Loading your Certificate of Registration")).toBeInTheDocument();
    expect(
      await screen.findByText("No courses are listed on this certificate."),
    ).toBeInTheDocument();
  });

  it("AC-ENRL-003.1: passes the axe check and every action is a keyboard-reachable button", async () => {
    const user = userEvent.setup();
    openCertificate();

    const download = await screen.findByRole("button", { name: "Download PDF" });
    await expectNoA11yViolations(download.closest("main") ?? document.body);

    download.focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Print" })).toHaveFocus();
  });
});
