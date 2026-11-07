import { mockApi } from "@cbpupsis/account/testing";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { session } from "../../lib/auth";
import { expectNoA11yViolations } from "../../test/axe";
import { me, ME_ROUTE, signInDirectly } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";

const ELIGIBILITY = "GET /student/enrollment/eligibility";
const COURSES = "GET /student/enrollment/available-courses?term=2026-2027-first";
const REQUESTS = "GET /student/enrollment/add-drop";
const CREATE = "POST /student/enrollment/add-drop";
const SCHEDULE = "GET /students/me/schedule";

function eligibility(overrides: Record<string, unknown> = {}) {
  return {
    isEligible: true,
    isEnrolled: true,
    enrollmentStatus: "ENROLLED",
    term: "2026-2027-first",
    termId: "term-1",
    termType: "REGULAR",
    prescribedLoad: 18,
    approvedOverloadUnits: 0,
    standingReduction: 0,
    effectiveCeiling: 18,
    academicStanding: "Good Standing",
    overloadEligible: false,
    summerSubjectCap: null,
    holds: [],
    addDropDeadline: "2099-08-22T00:00:00Z",
    academicPeriod: { start: "2026-08-01T00:00:00Z", end: "2026-08-31T00:00:00Z", isOpen: true },
    currentEnrollment: {
      enrollmentId: "enr-1",
      status: "ENROLLED",
      totalUnits: 3,
      sections: [
        { sectionId: "sec-enrolled", courseCode: "COMP 016", title: "Web Development", units: 3 },
      ],
    },
    ...overrides,
  };
}
function course(overrides: Record<string, unknown> = {}) {
  return {
    sectionId: "sec-add",
    courseCode: "COMP 020",
    title: "Information Assurance",
    units: 3,
    schedule: [],
    faculty: null,
    capacity: 40,
    availableSlots: 10,
    prerequisitesSatisfied: true,
    blockReason: null,
    conflictsWith: [],
    ...overrides,
  };
}
function request(overrides: Record<string, unknown> = {}) {
  return {
    requestId: "request-1",
    studentId: "student-1",
    academicTermId: "term-1",
    state: "PENDING",
    unitsBefore: 3,
    unitsAfter: 3,
    comments: null,
    remarks: "Registrar review in progress.",
    version: 1,
    courses: [
      {
        sectionId: "sec-enrolled",
        courseCode: "COMP 016",
        courseTitle: "Web Development",
        units: 3,
        tag: "PENDING_DROP",
        reason: "Academic concern",
      },
    ],
    createdAt: "2026-08-10T08:00:00Z",
    reviewedAt: null,
    ...overrides,
  };
}
function open(routes: Parameters<typeof mockApi>[0] = {}) {
  signInDirectly();
  const api = mockApi({
    [ME_ROUTE]: { status: 200, body: me },
    [ELIGIBILITY]: { status: 200, body: eligibility() },
    [COURSES]: { status: 200, body: [course()] },
    [REQUESTS]: { status: 200, body: [] },
    [SCHEDULE]: {
      status: 200,
      body: { term: null, courses: [], totalCredits: 0, state: "notEnrolled", message: null },
    },
    ...routes,
  });
  renderApp("/enrollment/add-drop");
  return api;
}
afterEach(() => session.signOut());

describe("AddDropPage (US-ENRL-004)", () => {
  it("AC-ENRL-004.1 stages adds and drops, then submits exactly once", async () => {
    const user = userEvent.setup();
    const api = open({ [CREATE]: { status: 201, body: request() } });
    await user.click(await screen.findByRole("button", { name: "Drop" }));
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText("2 total")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(api.called(CREATE)).toHaveLength(1);
  });
  it("AC-ENRL-004.3 keeps reviewer remarks visible with request status", async () => {
    open({
      [REQUESTS]: {
        status: 200,
        body: [request({ state: "REJECTED", remarks: "Please consult your adviser." })],
      },
    });
    expect(await screen.findByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText(/Please consult your adviser/)).toBeInTheDocument();
  });
  it("AC-ENRL-004.7 replaces the form when the period closes", async () => {
    const user = userEvent.setup();
    open({ [CREATE]: { status: 409, body: { code: "ENROLL_ADD_DROP_PERIOD_CLOSED" } } });
    await user.click(await screen.findByRole("button", { name: "Drop" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(
      await screen.findByRole("heading", { name: "Add and drop is closed" }),
    ).toBeInTheDocument();
  });
  it("AC-ENRL-004.8 names the minimum-load refusal", async () => {
    const user = userEvent.setup();
    open({ [CREATE]: { status: 409, body: { code: "ENROLL_BELOW_MINIMUM_LOAD" } } });
    await user.click(await screen.findByRole("button", { name: "Drop" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This drop leaves you under the N-unit minimum.",
    );
  });
  it("AC-ENRL-004.9 names an unavailable request", async () => {
    const user = userEvent.setup();
    open({ [CREATE]: { status: 404, body: { code: "RESOURCE_NOT_FOUND" } } });
    await user.click(await screen.findByRole("button", { name: "Drop" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This request is not available.");
  });
  it("AC-ENRL-004.10 shows the standard enrollment refusal", async () => {
    const user = userEvent.setup();
    open({
      [CREATE]: {
        status: 409,
        body: {
          code: "ENROLL_SECTION_FULL",
          detail: "This section just filled up. Pick another section.",
        },
      },
    });
    await user.click(await screen.findByRole("button", { name: "Add" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This section just filled up. Pick another section.",
    );
  });
  it("AC-ENRL-004.1 supports keyboard navigation and has no accessibility violations", async () => {
    const user = userEvent.setup();
    open();
    const drop = await screen.findByRole("button", { name: "Drop" });
    drop.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Undo drop" })).toHaveFocus();
    await expectNoA11yViolations(drop.closest("main") ?? document.body);
  });
});
