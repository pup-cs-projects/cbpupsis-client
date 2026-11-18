import { mockApi } from "@cbpupsis/account/testing";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { expectNoA11yViolations } from "../../test/axe";
import { me, ME_ROUTE, signInDirectly } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";

const ELIGIBILITY_ROUTE = "GET /student/enrollment/eligibility";
const COURSES_ROUTE = "GET /student/enrollment/available-courses";
const SUBMIT_ROUTE = "POST /student/enrollment/submit";
const OVERLOAD_ROUTE = "POST /student/enrollment/overload";
const COR_ROUTE = "GET /student/schedule/cor";
const ISSUE_ROUTE = "POST /student/schedule/cor";
const TERM_ID = "00000000-0000-0000-0000-000000000001";

function eligibility(overrides: Record<string, unknown> = {}) {
  return {
    isEligible: true,
    term: "2026-2027-First Semester",
    academicTermId: TERM_ID,
    termType: "REGULAR",
    prescribedLoad: 26,
    approvedOverloadUnits: 0,
    standingReduction: 0,
    effectiveCeiling: 26,
    academicStanding: "Good Standing",
    overloadEligible: false,
    summerSubjectCap: null,
    holds: [],
    academicPeriod: { start: "2026-06-01T00:00:00Z", end: "2026-06-30T00:00:00Z", isOpen: true },
    reasons: [],
    ...overrides,
  };
}

function section(overrides: Record<string, unknown> = {}) {
  return {
    sectionId: "sec-1",
    courseCode: "COMP 016",
    title: "Web Development",
    units: 3,
    schedule: [{ day: 0, start: "13:30:00", end: "16:30:00", room: "S508" }],
    faculty: "AJ San Luis",
    capacity: 40,
    availableSlots: 10,
    prerequisitesSatisfied: true,
    blockReason: null,
    conflictsWith: [],
    ...overrides,
  };
}

function openEnrollment(routes: Parameters<typeof mockApi>[0] = {}) {
  signInDirectly();
  const api = mockApi({
    [ME_ROUTE]: { status: 200, body: me },
    [ELIGIBILITY_ROUTE]: { status: 200, body: eligibility() },
    [COURSES_ROUTE]: { status: 200, body: [section()] },
    ...routes,
  });
  renderApp("/enrollment");
  return api;
}

/** A paragraph whose whole text, across its inline children, is exactly `text`. */
function paragraph(text: string) {
  return (_: string, element: Element | null) =>
    element?.tagName === "P" && element.textContent === text;
}

async function pickFirstCourse(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("checkbox", { name: /Select COMP 016/ }));
}

async function reviewAndConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Review and Submit" }));
  await user.click(await screen.findByRole("button", { name: "Confirm & Submit" }));
}

afterEach(() => {
  session.signOut();
  vi.unstubAllGlobals();
});

const ENROLLED = {
  status: 201,
  body: {
    enrollmentId: "enr-9",
    status: "ENROLLED_PENDING",
    totalUnits: "3",
    sections: [
      { sectionId: "sec-1", courseCode: "COMP 016", title: "Web Development", units: "3" },
    ],
  },
};

describe("EnrollmentPage (US-ENRL-001)", () => {
  it("AC-ENRL-001.12: after enrolling, downloads the official COR PDF from the API, issuing it once first", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:cor");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const api = openEnrollment({
      [SUBMIT_ROUTE]: ENROLLED,
      [COR_ROUTE]: [
        {
          status: 409,
          body: {
            code: "COR_ENROLLMENT_NOT_FINAL",
            message: "Certificate enrollment is not final.",
            details: { unmet: [] },
          },
        },
        { status: 200, body: "%PDF-1.4", headers: { "Content-Type": "application/pdf" } },
      ],
      [ISSUE_ROUTE]: {
        status: 201,
        body: { certificateId: "c-1", issuedAt: "2026-06-02T00:00:00Z", status: "CURRENT" },
      },
    });

    await pickFirstCourse(user);
    await reviewAndConfirm(user);
    await user.click(
      await screen.findByRole("button", { name: "Download Certificate of Registration (COR)" }),
    );

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    expect(api.called(ISSUE_ROUTE)).toHaveLength(1);
    expect(api.called(ISSUE_ROUTE)[0]?.body).toEqual({ academicTermId: TERM_ID });
    expect(api.called(COR_ROUTE)).toHaveLength(2);
  });

  it("AC-ENRL-001.12: a COR the API cannot make yet says why, in words", async () => {
    const user = userEvent.setup();
    openEnrollment({
      [SUBMIT_ROUTE]: ENROLLED,
      [COR_ROUTE]: {
        status: 409,
        body: { code: "COR_ENROLLMENT_NOT_FINAL", details: { unmet: ["NO_ASSESSMENT"] } },
      },
    });

    await pickFirstCourse(user);
    await reviewAndConfirm(user);
    await user.click(
      await screen.findByRole("button", { name: "Download Certificate of Registration (COR)" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your fees have not been assessed yet.",
    );
  });

  it("AC-ENRL-001.1: enrolls within the real, curriculum-sourced ceiling and shows the enrolled list", async () => {
    const user = userEvent.setup();
    const api = openEnrollment({
      [ELIGIBILITY_ROUTE]: {
        status: 200,
        body: eligibility({ prescribedLoad: 26, effectiveCeiling: 26 }),
      },
      [COURSES_ROUTE]: { status: 200, body: [section({ units: 26 })] },
      [SUBMIT_ROUTE]: {
        status: 201,
        body: {
          enrollmentId: "enr-1",
          status: "ENROLLED_PENDING",
          totalUnits: 26,
          sections: [
            { sectionId: "sec-1", courseCode: "COMP 016", title: "Web Development", units: 26 },
          ],
        },
      },
    });

    expect(await screen.findByRole("status", { name: "Running total" })).toHaveTextContent(
      "of 26 allowed",
    );

    await pickFirstCourse(user);
    await reviewAndConfirm(user);

    expect(await screen.findByRole("heading", { name: "You're enrolled" })).toBeInTheDocument();
    expect(screen.getByText("(S.Y. 2026-2027, First Semester)")).toBeInTheDocument();
    expect(screen.getByText("COMP 016")).toBeInTheDocument();
    expect(screen.getByText("Web Development")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Download Certificate of Registration (COR)" }),
    ).toBeInTheDocument();
    expect(api.called(SUBMIT_ROUTE)).toHaveLength(1);
    expect(api.called(SUBMIT_ROUTE)[0]?.body).toEqual({
      academicTermId: TERM_ID,
      sectionIds: ["sec-1"],
      confirmation: true,
    });
    expect(api.called(COURSES_ROUTE)).toHaveLength(1);
  });

  it("AC-ENRL-001.2: a submit over the ceiling names the limit and the units left", async () => {
    const user = userEvent.setup();
    openEnrollment({
      [ELIGIBILITY_ROUTE]: {
        status: 200,
        body: eligibility({ prescribedLoad: 26, effectiveCeiling: 26 }),
      },
      [COURSES_ROUTE]: { status: 200, body: [section({ units: 29 })] },
      [SUBMIT_ROUTE]: {
        status: 409,
        body: {
          message: "The selected load exceeds your enrollment unit ceiling.",
          code: "ENROLL_UNIT_CEILING_EXCEEDED",
          request_id: "req-ceiling",
          details: { effectiveCeiling: "26", attemptedUnits: "29", unitsRemaining: "0" },
        },
      },
    });

    await pickFirstCourse(user);
    await reviewAndConfirm(user);

    expect(
      await screen.findByText("This goes over your limit of 26 units. You have 0 units left."),
    ).toBeInTheDocument();
  });

  it("AC-ENRL-001.3: an approved overload raises the ceiling and lets the student enroll past the base load", async () => {
    const user = userEvent.setup();
    openEnrollment({
      [ELIGIBILITY_ROUTE]: {
        status: 200,
        body: eligibility({ prescribedLoad: 26, approvedOverloadUnits: 9, effectiveCeiling: 35 }),
      },
      [COURSES_ROUTE]: { status: 200, body: [section({ units: 35 })] },
      [SUBMIT_ROUTE]: {
        status: 201,
        body: {
          enrollmentId: "enr-2",
          status: "ENROLLED_PENDING",
          totalUnits: 35,
          sections: [
            { sectionId: "sec-1", courseCode: "COMP 016", title: "Web Development", units: 35 },
          ],
        },
      },
    });

    expect(await screen.findByRole("status", { name: "Running total" })).toHaveTextContent(
      "of 35 allowed",
    );
    await pickFirstCourse(user);
    await reviewAndConfirm(user);

    expect(await screen.findByRole("heading", { name: "You're enrolled" })).toBeInTheDocument();
  });

  it("AC-ENRL-001.4: an overload request over the 9-unit cap is refused with the fixed cap", async () => {
    const user = userEvent.setup();
    openEnrollment({
      [ELIGIBILITY_ROUTE]: { status: 200, body: eligibility({ overloadEligible: true }) },
      [OVERLOAD_ROUTE]: {
        status: 409,
        body: { code: "ENROLL_OVERLOAD_CAP_EXCEEDED", request_id: "req-cap" },
      },
    });

    await user.click(await screen.findByRole("button", { name: "Request an overload" }));
    const unitsField = screen.getByLabelText(/Extra units/);
    await user.clear(unitsField);
    await user.type(unitsField, "9");
    await user.type(screen.getByLabelText(/Why do you need it/), "Need an extra course this term.");
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByText("An overload can add at most 9 units.")).toBeInTheDocument();
  });

  it("AC-ENRL-001.5: an ineligible overload request explains the two ways to qualify", async () => {
    const user = userEvent.setup();
    openEnrollment({
      [ELIGIBILITY_ROUTE]: { status: 200, body: eligibility({ overloadEligible: true }) },
      // No `detail`: this exercises the client's own fallback text, naming both paths.
      [OVERLOAD_ROUTE]: {
        status: 409,
        body: { code: "ENROLL_OVERLOAD_NOT_ELIGIBLE", request_id: "req-elig" },
      },
    });

    await user.click(await screen.findByRole("button", { name: "Request an overload" }));
    const unitsField = screen.getByLabelText(/Extra units/);
    await user.clear(unitsField);
    await user.type(unitsField, "3");
    await user.type(screen.getByLabelText(/Why do you need it/), "I want to graduate sooner.");
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    expect(
      await screen.findByText(/completed at least 85% of your curriculum units/),
    ).toBeInTheDocument();
  });

  it("AC-ENRL-001.6: Warning Level 2 shows an effective ceiling of 23 for a prescribed 26, from the API alone", async () => {
    openEnrollment({
      [ELIGIBILITY_ROUTE]: {
        status: 200,
        body: eligibility({
          prescribedLoad: 26,
          standingReduction: 3,
          effectiveCeiling: 23,
          academicStanding: "Warning Level 2",
        }),
      },
    });

    expect(await screen.findByRole("status", { name: "Running total" })).toHaveTextContent(
      "of 23 allowed",
    );
  });

  it("AC-ENRL-001.7: Probation shows an effective ceiling of 20 for a prescribed 26, from the API alone", async () => {
    openEnrollment({
      [ELIGIBILITY_ROUTE]: {
        status: 200,
        body: eligibility({
          prescribedLoad: 26,
          standingReduction: 6,
          effectiveCeiling: 20,
          academicStanding: "Probation",
        }),
      },
    });

    expect(await screen.findByRole("status", { name: "Running total" })).toHaveTextContent(
      "of 20 allowed",
    );
  });

  it("AC-ENRL-001.8 (display): shows the summer subject limit for a student it applies to", async () => {
    openEnrollment({
      [ELIGIBILITY_ROUTE]: {
        status: 200,
        body: eligibility({ termType: "SUMMER", summerSubjectCap: 2 }),
      },
    });

    expect(await screen.findByText("Summer limit: 2 subjects")).toBeInTheDocument();
  });

  it("AC-ENRL-001.8 (refusal): a third summer subject over the cap is refused with the exact limit", async () => {
    const user = userEvent.setup();
    openEnrollment({
      [ELIGIBILITY_ROUTE]: {
        status: 200,
        body: eligibility({ termType: "SUMMER", summerSubjectCap: 2 }),
      },
      [SUBMIT_ROUTE]: {
        status: 409,
        body: {
          code: "ENROLL_SUMMER_SUBJECT_LIMIT",
          request_id: "req-summer",
          details: { summerSubjectCap: 2 },
        },
      },
    });

    await pickFirstCourse(user);
    await reviewAndConfirm(user);

    expect(
      await screen.findByText("Summer allows at most 2 subjects for you."),
    ).toBeInTheDocument();
  });

  it("AC-ENRL-001.9: a schedule conflict names both courses and the overlap", async () => {
    const user = userEvent.setup();
    openEnrollment({
      [COURSES_ROUTE]: {
        status: 200,
        body: [
          section({ sectionId: "sec-1", courseCode: "COMP 016" }),
          section({
            sectionId: "sec-2",
            courseCode: "COSC 304",
            schedule: [{ day: 0, start: "10:30:00", end: "13:00:00", room: null }],
          }),
        ],
      },
      [SUBMIT_ROUTE]: {
        status: 409,
        body: {
          message: "COMP 016 and COSC 304 overlap on day 0 from 13:30:00 to 13:00:00.",
          code: "ENROLL_SCHEDULE_CONFLICT",
          request_id: "req-conflict",
          details: {
            courseCodes: ["COMP 016", "COSC 304"],
            sectionIds: ["sec-1", "sec-2"],
            overlap: { day: 0, start: "10:30:00", end: "13:00:00" },
          },
        },
      },
    });

    const checkboxes = await screen.findAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await reviewAndConfirm(user);

    // Once in the alert, and once in each named course's row.
    const messages = await screen.findAllByText(/^COMP 016 and COSC 304 overlap on Monday/);
    expect(messages).toHaveLength(3);
    const row = screen.getByRole("rowheader", { name: /^COSC 304/ }).closest("tr");
    expect(within(row as HTMLElement).getByText(/overlap on Monday/)).toBeInTheDocument();
  });

  it("AC-ENRL-001.10: an unresolved financial hold replaces the picker with the office and amount owed", async () => {
    openEnrollment({
      [ELIGIBILITY_ROUTE]: {
        status: 200,
        body: eligibility({
          isEligible: false,
          holds: [
            { office: "Accounting Office", type: "Financial Hold", amount: 3500, isBlocking: true },
          ],
        }),
      },
    });

    expect(
      await screen.findByRole("heading", { name: "You have a hold on your account" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Accounting Office")).toBeInTheDocument();
    expect(screen.getByText(/₱3,500/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("AC-ENRL-001.11: a section that just filled refuses with ENROLL_SECTION_FULL and reloads the list", async () => {
    const user = userEvent.setup();
    const api = openEnrollment({
      [COURSES_ROUTE]: [
        { status: 200, body: [section({ availableSlots: 1 })] },
        { status: 200, body: [section({ availableSlots: 0 })] },
      ],
      [SUBMIT_ROUTE]: {
        status: 409,
        body: {
          message: "A selected section has no seat available.",
          code: "ENROLL_SECTION_FULL",
          request_id: "req-full",
          details: { sectionId: "sec-1" },
        },
      },
    });

    await pickFirstCourse(user);
    await reviewAndConfirm(user);

    expect(
      (await screen.findAllByText("This section just filled up. Pick another section.")).length,
    ).toBeGreaterThan(0);
    await waitFor(() => expect(api.called(COURSES_ROUTE)).toHaveLength(2));
    expect(await screen.findByText("Full")).toBeInTheDocument();
  });

  it("AC-ENRL-001.12: a committed enrollment shows exactly the sections and total the API returns, sent once", async () => {
    const user = userEvent.setup();
    const api = openEnrollment({
      [SUBMIT_ROUTE]: {
        status: 201,
        body: {
          enrollmentId: "enr-3",
          status: "ENROLLED_PENDING",
          totalUnits: 3,
          sections: [
            { sectionId: "sec-1", courseCode: "COMP 016", title: "Web Development", units: 3 },
          ],
        },
      },
    });

    await pickFirstCourse(user);
    await reviewAndConfirm(user);

    expect(await screen.findByRole("heading", { name: "You're enrolled" })).toBeInTheDocument();
    expect(screen.getByText(paragraph("Total: 3 units"))).toBeInTheDocument();
    expect(api.called(SUBMIT_ROUTE)).toHaveLength(1);
  });

  it("AC-ENRL-001.13: an administrative hold replaces the picker with the office and how to clear it", async () => {
    openEnrollment({
      [ELIGIBILITY_ROUTE]: {
        status: 200,
        body: eligibility({
          isEligible: false,
          holds: [
            {
              office: "Office of Student Affairs",
              type: "Disciplinary Hold",
              amount: null,
              isBlocking: true,
            },
          ],
        }),
      },
    });

    expect(
      await screen.findByRole("heading", { name: "You have a hold on your account" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Office of Student Affairs")).toBeInTheDocument();
    expect(screen.getByText("Disciplinary Hold")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("AC-ENRL-001.14: a closed enrollment period replaces the picker with the period's dates", async () => {
    openEnrollment({
      [ELIGIBILITY_ROUTE]: {
        status: 200,
        body: eligibility({
          academicPeriod: {
            start: "2026-06-01T00:00:00Z",
            end: "2026-06-30T00:00:00Z",
            isOpen: false,
          },
        }),
      },
    });

    expect(
      await screen.findByRole("heading", { name: "Enrollment is closed" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/June 1 - June 30, 2026/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("AC-ENRL-001.10: a financial hold refused at submit names the office, the amount, and what to do", async () => {
    const user = userEvent.setup();
    openEnrollment({
      [SUBMIT_ROUTE]: {
        status: 409,
        body: {
          code: "ENROLL_FINANCIAL_HOLD",
          message:
            "Resolve the PHP 3500.00 financial hold with the Accounting Office before enrolling.",
          details: { office: "Accounting Office", outstandingAmount: "3500.00" },
        },
      },
    });

    await pickFirstCourse(user);
    await reviewAndConfirm(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /financial hold of ₱3,500.00 with the Accounting Office. Settle it there/,
    );
  });

  it("AC-ENRL-001.13: an active hold refused at submit names the office and what to do", async () => {
    const user = userEvent.setup();
    openEnrollment({
      [SUBMIT_ROUTE]: {
        status: 409,
        body: {
          code: "ENROLL_HOLD_ACTIVE",
          details: { office: "Office of Student Affairs", holdType: "DISCIPLINARY" },
        },
      },
    });

    await pickFirstCourse(user);
    await reviewAndConfirm(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You have a disciplinary hold with the Office of Student Affairs. Clear it there, then submit again.",
    );
  });

  it("AC-ENRL-001.14: a period that closed before submit shows its dates", async () => {
    const user = userEvent.setup();
    openEnrollment({
      [SUBMIT_ROUTE]: {
        status: 409,
        body: {
          code: "ENROLL_PERIOD_CLOSED",
          details: { start: "2026-06-01T00:00:00Z", end: "2026-06-30T00:00:00Z" },
        },
      },
    });

    await pickFirstCourse(user);
    await reviewAndConfirm(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enrollment is closed. The period runs June 1 - June 30, 2026.",
    );
  });

  it("AC-ENRL-001.10: an ineligible student with no hold sees the API's reasons", async () => {
    openEnrollment({
      [ELIGIBILITY_ROUTE]: {
        status: 200,
        body: eligibility({
          isEligible: false,
          reasons: [
            {
              code: "NO_PRESCRIBED_LOAD",
              message: "No prescribed curriculum load is configured for this term.",
            },
          ],
        }),
      },
    });

    expect(
      await screen.findByText("No prescribed curriculum load is configured for this term."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("AC-ENRL-002.1: a blocked section shows why and what unlocks it in its own row, with its waivers", async () => {
    openEnrollment({
      [COURSES_ROUTE]: {
        status: 200,
        body: [
          section({
            sectionId: "sec-9",
            courseCode: "COMP 009",
            prerequisitesSatisfied: false,
            blockReason: "COMP 003: Inc; required range 1.00-3.00.",
            blocks: [
              {
                rule: "ENROLL_PREREQUISITE_NOT_MET",
                courseCode: "COMP 003",
                blockingMark: "Inc",
                requiredRange: "1.00-3.00",
                details: {},
              },
            ],
            waiverAvailable: true,
          }),
        ],
      },
      "GET /student/enrollment/waiver": { status: 200, body: [] },
    });

    const row = (await screen.findByRole("rowheader", { name: /^COMP 009/ })).closest(
      "tr",
    ) as HTMLElement;
    expect(within(row).getByText("COMP 003: Inc; required range 1.00-3.00.")).toBeInTheDocument();
    expect(
      within(row).getByText("Pass COMP 003 with a mark from 1.00 to 3.00. Your mark: Inc."),
    ).toBeInTheDocument();
    expect(
      await within(row).findByText("You have not filed a waiver for this course."),
    ).toBeInTheDocument();
  });

  it("AC-ENRL-002.2: a prerequisite refusal at submit names the course and the mark needed", async () => {
    const user = userEvent.setup();
    openEnrollment({
      [COURSES_ROUTE]: {
        status: 200,
        body: [
          section({
            blocks: [
              {
                rule: "ENROLL_PREREQUISITE_NOT_MET",
                courseCode: "COMP 003",
                blockingMark: "5.00",
                requiredRange: "1.00-3.00",
                details: {},
              },
            ],
          }),
        ],
      },
      "GET /student/enrollment/waiver": { status: 200, body: [] },
      [SUBMIT_ROUTE]: {
        status: 409,
        body: { code: "ENROLL_PREREQUISITE_NOT_MET", details: { sectionId: "sec-1" } },
      },
    });

    await pickFirstCourse(user);
    await reviewAndConfirm(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You have not passed the prerequisite COMP 003: your mark is 5.00. You need 1.00 to 3.00.",
    );
  });

  it("AC-ENRL-001.12: a student who already submitted this term sees the enrolled state, not the picker", async () => {
    const api = openEnrollment({
      [ELIGIBILITY_ROUTE]: {
        status: 200,
        body: eligibility({
          currentEnrollment: {
            enrollmentId: "enr-5",
            status: "ENROLLED_PENDING",
            totalUnits: "18.0",
          },
        }),
      },
    });

    expect(await screen.findByRole("heading", { name: "You're enrolled" })).toBeInTheDocument();
    expect(screen.getByText("Submitted, waiting to be made official")).toBeInTheDocument();
    expect(screen.getByText("18 units")).toBeInTheDocument();
    expect(screen.getByTestId("enrollment-status-value")).toHaveTextContent("Enrolled");
    expect(
      screen.getByRole("link", { name: "View your Certificate of Registration" }),
    ).toHaveAttribute("href", "/enrollment/certificate");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(api.called(COURSES_ROUTE)).toHaveLength(0);
  });

  it("AC-ENRL-001.12: an officially enrolled student (legacy lowercase status too) reads Officially enrolled", async () => {
    openEnrollment({
      [ELIGIBILITY_ROUTE]: {
        status: 200,
        body: eligibility({
          academicPeriod: {
            start: "2026-06-01T00:00:00Z",
            end: "2026-06-30T00:00:00Z",
            isOpen: false,
          },
          currentEnrollment: { enrollmentId: "enr-6", status: "enrolled", totalUnits: "19" },
        }),
      },
    });

    expect(await screen.findByText("Officially enrolled")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Enrollment is closed" })).not.toBeInTheDocument();
  });

  it("AC-ENRL-001.15: shows no subject limit for a summer student outside the capped groups", async () => {
    const user = userEvent.setup();
    openEnrollment({
      [ELIGIBILITY_ROUTE]: {
        status: 200,
        body: eligibility({ termType: "SUMMER", summerSubjectCap: null }),
      },
      [SUBMIT_ROUTE]: {
        status: 201,
        body: {
          enrollmentId: "enr-4",
          status: "ENROLLED_PENDING",
          totalUnits: 3,
          sections: [
            { sectionId: "sec-1", courseCode: "COMP 016", title: "Web Development", units: 3 },
          ],
        },
      },
    });

    await pickFirstCourse(user);
    expect(screen.queryByText(/Summer limit/)).not.toBeInTheDocument();

    await reviewAndConfirm(user);
    expect(await screen.findByRole("heading", { name: "You're enrolled" })).toBeInTheDocument();
  });

  it("AC-ENRL-001.3: shows 'Waiting for the Dean' once an overload request is filed", async () => {
    const user = userEvent.setup();
    openEnrollment({
      [ELIGIBILITY_ROUTE]: { status: 200, body: eligibility({ overloadEligible: true }) },
      [OVERLOAD_ROUTE]: {
        status: 202,
        body: { overloadRequestId: "ovl-1", state: "PENDING_DEAN" },
      },
    });

    await user.click(await screen.findByRole("button", { name: "Request an overload" }));
    const unitsField = screen.getByLabelText(/Extra units/);
    await user.clear(unitsField);
    await user.type(unitsField, "3");
    await user.type(screen.getByLabelText(/Why do you need it/), "To finish my minor this term.");
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByText("Waiting for the Dean")).toBeInTheDocument();
  });

  it("AC-ENRL-001.3: an overload already waiting for the Dean shows 'Waiting for the Dean' on load", async () => {
    openEnrollment({
      [ELIGIBILITY_ROUTE]: {
        status: 200,
        body: eligibility({ overloadEligible: true, pendingOverloadUnits: "3" }),
      },
    });

    expect(await screen.findByText("Waiting for the Dean")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Request an overload" })).not.toBeInTheDocument();
  });

  it("AC-ENRL-001.5: does not offer an overload request to a student who does not qualify", async () => {
    openEnrollment({
      [ELIGIBILITY_ROUTE]: { status: 200, body: eligibility({ overloadEligible: false }) },
    });

    await screen.findByRole("status", { name: "Running total" });
    expect(screen.queryByRole("button", { name: "Request an overload" })).not.toBeInTheDocument();
  });

  it("AC-ENRL-001.1: registers /enrollment and highlights Enrollment as the active Academics item", async () => {
    const user = userEvent.setup();
    openEnrollment();
    await screen.findByRole("heading", { name: "Course Enrollment" });

    await user.click(screen.getByRole("button", { name: "Expand menu" }));
    const link = await screen.findByRole("link", { name: "Enrollment" });
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("AC-ENRL-001.2: updates the running total live as checkboxes toggle, and warns without disabling submit when over the limit", async () => {
    const user = userEvent.setup();
    openEnrollment({
      [ELIGIBILITY_ROUTE]: {
        status: 200,
        body: eligibility({ prescribedLoad: 4, effectiveCeiling: 4 }),
      },
      [COURSES_ROUTE]: {
        status: 200,
        body: [
          section({ sectionId: "sec-1", units: 3 }),
          section({
            sectionId: "sec-2",
            courseCode: "COSC 304",
            units: 3,
            schedule: [{ day: 1, start: "10:30:00", end: "13:00:00", room: null }],
          }),
        ],
      },
    });

    const total = await screen.findByRole("status", { name: "Running total" });
    expect(total).toHaveTextContent("Running Total: 0 units");

    const checkboxes = await screen.findAllByRole("checkbox");
    await user.click(checkboxes[0]);
    expect(total).toHaveTextContent("Running Total: 3 units");

    await user.click(checkboxes[1]);
    expect(total).toHaveTextContent("Running Total: 6 units");
    expect(total).toHaveTextContent("over your limit of 4");

    expect(screen.getByRole("button", { name: "Review and Submit" })).not.toBeDisabled();
  });

  it("AC-ENRL-001.1: clears every pick with Clear All, back to the 'No Selected Course' empty state", async () => {
    const user = userEvent.setup();
    openEnrollment({
      [COURSES_ROUTE]: {
        status: 200,
        body: [
          section({ sectionId: "sec-1" }),
          section({
            sectionId: "sec-2",
            courseCode: "COSC 304",
            schedule: [{ day: 1, start: "10:30:00", end: "13:00:00", room: null }],
          }),
        ],
      },
    });

    expect(await screen.findByText("No Selected Course")).toBeInTheDocument();

    const checkboxes = await screen.findAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    expect(screen.queryByText("No Selected Course")).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Running total" })).toHaveTextContent(
      "Running Total: 6 units",
    );

    await user.click(screen.getByRole("button", { name: "Clear All" }));

    expect(await screen.findByText("No Selected Course")).toBeInTheDocument();
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it("AC-ENRL-001.1: names each course and its units in the checkbox's own label", async () => {
    openEnrollment({
      [COURSES_ROUTE]: {
        status: 200,
        body: [section({ courseCode: "COMP 016", title: "Web Development", units: 3 })],
      },
    });

    expect(
      await screen.findByRole("checkbox", { name: "Select COMP 016: Web Development, 3 units" }),
    ).toBeInTheDocument();
  });

  it("AC-ENRL-001.12: disables the confirm button while the submit is in flight", async () => {
    const user = userEvent.setup();
    openEnrollment({ [SUBMIT_ROUTE]: "pending" });

    await pickFirstCourse(user);
    await user.click(screen.getByRole("button", { name: "Review and Submit" }));
    const confirmButton = await screen.findByRole("button", { name: "Confirm & Submit" });
    await user.click(confirmButton);

    expect(await screen.findByRole("button", { name: "Submitting…" })).toBeDisabled();
  });

  it("AC-ENRL-001.12: summarizes the picked sections and total before submit is ever called", async () => {
    const user = userEvent.setup();
    const api = openEnrollment({ [SUBMIT_ROUTE]: "pending" });

    await pickFirstCourse(user);
    await user.click(screen.getByRole("button", { name: "Review and Submit" }));

    const dialog = await screen.findByRole("dialog", { name: "Confirm Your Enrollment" });
    expect(within(dialog).getByText("COMP 016: Web Development")).toBeInTheDocument();
    expect(within(dialog).getByText(paragraph("Total: 3 units"))).toBeInTheDocument();
    expect(api.called(SUBMIT_ROUTE)).toHaveLength(0);
  });

  it("AC-ENRL-001.1: offers a working retry when the enrollment information cannot be loaded", async () => {
    const user = userEvent.setup();
    openEnrollment({
      [ELIGIBILITY_ROUTE]: ["offline", { status: 200, body: eligibility() }],
    });

    const retry = await screen.findByRole("button", { name: /try again/i });
    await user.click(retry);

    await screen.findByRole("status", { name: "Running total" });
  });

  it("AC-ENRL-001.1: shows a loading message while the enrollment information loads", async () => {
    openEnrollment({ [ELIGIBILITY_ROUTE]: "pending" });

    expect(await screen.findByText("Loading your enrollment information")).toBeInTheDocument();
  });

  it("AC-ENRL-001.1: shows an empty state when no courses are open this term", async () => {
    openEnrollment({ [COURSES_ROUTE]: { status: 200, body: [] } });

    expect(await screen.findByText("No courses are open to you this term.")).toBeInTheDocument();
  });

  it("AC-ENRL-001.1: passes an automated accessibility check with no violations", async () => {
    openEnrollment({
      [ELIGIBILITY_ROUTE]: { status: 200, body: eligibility({ overloadEligible: true }) },
    });
    // Wait for the fully loaded, interactive page (table, checkboxes, overload button), not
    // the loading skeleton the heading alone would still let through.
    const checkbox = await screen.findByRole("checkbox", { name: /Select COMP 016/ });

    await expectNoA11yViolations(checkbox.closest("main") ?? document.body);
  });

  it("AC-ENRL-001.1: lets a keyboard user tab to a course checkbox and toggle it with the keyboard alone", async () => {
    const user = userEvent.setup();
    openEnrollment();

    const checkbox = await screen.findByRole("checkbox", { name: /Select COMP 016/ });
    checkbox.focus();
    expect(checkbox).toHaveFocus();

    await user.keyboard(" ");
    expect(checkbox).toBeChecked();
    expect(screen.getByRole("status", { name: "Running total" })).toHaveTextContent(
      "Running Total: 3 units",
    );
  });
});
