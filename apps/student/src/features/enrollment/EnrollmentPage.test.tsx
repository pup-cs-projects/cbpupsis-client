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
const DASHBOARD_ROUTE = "GET /student/me/dashboard";

function eligibility(overrides: Record<string, unknown> = {}) {
  return {
    isEligible: true,
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
    ...overrides,
  };
}

function section(overrides: Record<string, unknown> = {}) {
  return {
    sectionId: "sec-1",
    courseCode: "COMP 016",
    title: "Web Development",
    units: 3,
    schedule: [{ dayOfWeek: 0, startTime: "13:30", endTime: "16:30", room: "S508" }],
    facultyName: "AJ San Luis",
    capacity: 40,
    availableSlots: 10,
    prerequisitesSatisfied: true,
    blockReason: null,
    conflictsWith: [],
    ...overrides,
  };
}

function dashboardBody() {
  return {
    status: "success",
    data: {
      student: {
        student_number: "sn-001",
        name: "Juan Dela Cruz",
        programme: null,
        year_level: 1,
        enrollment_status: "ENROLLED",
        avatar_url: null,
      },
      current_term: null,
      holds: [],
      standing: { value: "GOOD", unit_reduction: 0 },
      enrollment: {},
      periods: [],
      announcements: [],
      events: [],
      recent_activity: [],
      empty_states: {},
    },
  };
}

function openEnrollment(routes: Parameters<typeof mockApi>[0] = {}) {
  signInDirectly();
  const api = mockApi({
    [ME_ROUTE]: { status: 200, body: me },
    [DASHBOARD_ROUTE]: { status: 200, body: dashboardBody() },
    [ELIGIBILITY_ROUTE]: { status: 200, body: eligibility() },
    [COURSES_ROUTE]: { status: 200, body: [section()] },
    ...routes,
  });
  renderApp("/enrollment");
  return api;
}

/** The dd beside a dt with this label, for a stat that may repeat its sibling's value. */
function statValue(label: string) {
  return screen.getByText(label).nextElementSibling;
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

describe("EnrollmentPage (US-ENRL-001)", () => {
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

    await screen.findByText("Effective Ceiling");
    expect(statValue("Effective Ceiling")).toHaveTextContent("26");

    await pickFirstCourse(user);
    await reviewAndConfirm(user);

    expect(await screen.findByRole("heading", { name: "You're enrolled" })).toBeInTheDocument();
    expect(screen.getByText("COMP 016: Web Development")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Certificate of Registration/ })).toHaveAttribute(
      "href",
      "/enrollment/certificate",
    );
    expect(api.called(SUBMIT_ROUTE)).toHaveLength(1);
    expect(api.called(SUBMIT_ROUTE)[0]?.body).toEqual({
      sectionIds: ["sec-1"],
      confirmation: true,
    });
  });

  it("AC-ENRL-001.2: a submit over the ceiling names the limit and the units left, in the API's own words", async () => {
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
          detail: "This goes over your limit of 26 units. You have 3 units left.",
          code: "ENROLL_UNIT_CEILING_EXCEEDED",
          request_id: "req-ceiling",
        },
      },
    });

    await pickFirstCourse(user);
    await reviewAndConfirm(user);

    expect(
      await screen.findByText("This goes over your limit of 26 units. You have 3 units left."),
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

    await screen.findByText("Effective Ceiling");
    expect(statValue("Effective Ceiling")).toHaveTextContent("35");
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

    await screen.findByText("Effective Ceiling");
    expect(statValue("Prescribed Load")).toHaveTextContent("26");
    expect(statValue("Standing Reduction")).toHaveTextContent("3");
    expect(statValue("Effective Ceiling")).toHaveTextContent("23");
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

    await screen.findByText("Effective Ceiling");
    expect(statValue("Standing Reduction")).toHaveTextContent("6");
    expect(statValue("Effective Ceiling")).toHaveTextContent("20");
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
      // No `detail`: this exercises the client's own fallback text, built from summerSubjectCap.
      [SUBMIT_ROUTE]: {
        status: 409,
        body: { code: "ENROLL_SUMMER_SUBJECT_LIMIT", request_id: "req-summer" },
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
            schedule: [{ dayOfWeek: 0, startTime: "10:30", endTime: "13:00", room: null }],
          }),
        ],
      },
      [SUBMIT_ROUTE]: {
        status: 409,
        body: {
          detail: "COMP 016 and COSC 304 both meet Monday 10:30 to 13:00.",
          code: "ENROLL_SCHEDULE_CONFLICT",
          request_id: "req-conflict",
        },
      },
    });

    const checkboxes = await screen.findAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    await reviewAndConfirm(user);

    expect(
      await screen.findByText("COMP 016 and COSC 304 both meet Monday 10:30 to 13:00."),
    ).toBeInTheDocument();
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
          detail: "This section just filled up. Pick another section.",
          code: "ENROLL_SECTION_FULL",
          request_id: "req-full",
        },
      },
    });

    await pickFirstCourse(user);
    await reviewAndConfirm(user);

    expect(
      await screen.findByText("This section just filled up. Pick another section."),
    ).toBeInTheDocument();
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
    expect(screen.getByText("Total: 3 units")).toBeInTheDocument();
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

  it("shows 'Waiting for the Dean' once an overload request is filed", async () => {
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

  it("does not offer an overload request to a student who does not qualify", async () => {
    openEnrollment({
      [ELIGIBILITY_ROUTE]: { status: 200, body: eligibility({ overloadEligible: false }) },
    });

    await screen.findByText("Effective Ceiling");
    expect(screen.queryByRole("button", { name: "Request an overload" })).not.toBeInTheDocument();
  });

  it("registers /enrollment and highlights Enrollment as the active Academics item", async () => {
    const user = userEvent.setup();
    openEnrollment();
    await screen.findByRole("heading", { name: "Course Enrollment" });

    await user.click(screen.getByRole("button", { name: "Expand menu" }));
    const link = await screen.findByRole("link", { name: "Enrollment" });
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("updates the running total live as checkboxes toggle, and warns without disabling submit when over the limit", async () => {
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
            schedule: [{ dayOfWeek: 1, startTime: "10:30", endTime: "13:00", room: null }],
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

  it("clears every pick with Clear All, back to the 'No Selected Course' empty state", async () => {
    const user = userEvent.setup();
    openEnrollment({
      [COURSES_ROUTE]: {
        status: 200,
        body: [
          section({ sectionId: "sec-1" }),
          section({
            sectionId: "sec-2",
            courseCode: "COSC 304",
            schedule: [{ dayOfWeek: 1, startTime: "10:30", endTime: "13:00", room: null }],
          }),
        ],
      },
    });

    expect(await screen.findByText("No Selected Course")).toBeInTheDocument();

    const checkboxes = await screen.findAllByRole("checkbox");
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);
    expect(screen.queryByText("No Selected Course")).not.toBeInTheDocument();
    expect(screen.getByText("Total: 6 units")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear All" }));

    expect(await screen.findByText("No Selected Course")).toBeInTheDocument();
    expect(checkboxes[0]).not.toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it("names each course and its units in the checkbox's own label", async () => {
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

  it("disables the confirm button while the submit mutation is in flight", async () => {
    const user = userEvent.setup();
    openEnrollment({ [SUBMIT_ROUTE]: "pending" });

    await pickFirstCourse(user);
    await user.click(screen.getByRole("button", { name: "Review and Submit" }));
    const confirmButton = await screen.findByRole("button", { name: "Confirm & Submit" });
    await user.click(confirmButton);

    expect(await screen.findByRole("button", { name: "Submitting…" })).toBeDisabled();
  });

  it("summarizes the picked sections and total before submit is ever called", async () => {
    const user = userEvent.setup();
    const api = openEnrollment({ [SUBMIT_ROUTE]: "pending" });

    await pickFirstCourse(user);
    await user.click(screen.getByRole("button", { name: "Review and Submit" }));

    const dialog = await screen.findByRole("dialog", { name: "Confirm Your Enrollment" });
    expect(within(dialog).getByText("COMP 016: Web Development")).toBeInTheDocument();
    expect(within(dialog).getByText("Total: 3 units")).toBeInTheDocument();
    expect(api.called(SUBMIT_ROUTE)).toHaveLength(0);
  });

  it("offers a working retry when the enrollment information cannot be loaded", async () => {
    const user = userEvent.setup();
    openEnrollment({
      [ELIGIBILITY_ROUTE]: ["offline", { status: 200, body: eligibility() }],
    });

    const retry = await screen.findByRole("button", { name: /try again/i });
    await user.click(retry);

    await screen.findByText("Effective Ceiling");
  });

  it("shows an empty state when no courses are open this term", async () => {
    openEnrollment({ [COURSES_ROUTE]: { status: 200, body: [] } });

    expect(await screen.findByText("No courses are open to you this term.")).toBeInTheDocument();
  });

  it("passes an automated accessibility check with no violations", async () => {
    openEnrollment({
      [ELIGIBILITY_ROUTE]: { status: 200, body: eligibility({ overloadEligible: true }) },
    });
    // Wait for the fully loaded, interactive page (table, checkboxes, overload button), not
    // the loading skeleton the heading alone would still let through.
    const checkbox = await screen.findByRole("checkbox", { name: /Select COMP 016/ });

    await expectNoA11yViolations(checkbox.closest("main") ?? document.body);
  });

  it("lets a keyboard user tab to a course checkbox and toggle it with the keyboard alone", async () => {
    const user = userEvent.setup();
    openEnrollment();

    const checkbox = await screen.findByRole("checkbox", { name: /Select COMP 016/ });
    checkbox.focus();
    expect(checkbox).toHaveFocus();

    await user.keyboard(" ");
    expect(checkbox).toBeChecked();
    expect(screen.getByText("Total: 3 units")).toBeInTheDocument();
  });
});
