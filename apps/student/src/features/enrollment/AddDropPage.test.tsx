import { mockApi } from "@cbpupsis/account/testing";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { expectNoA11yViolations } from "../../test/axe";
import { me, ME_ROUTE, signInDirectly } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";

const SCHEDULE_ROUTE = "GET /student/schedule";
const AVAILABLE_ROUTE = "GET /student/enrollment/available-courses";
const LIST_ROUTE = "GET /student/enrollment/add-drop";
const CREATE_ROUTE = "POST /student/enrollment/add-drop";
const WINDOW_ROUTE = "GET /student/enrollment/eligibility";

const WEBDEV = "10000000-0000-4000-8000-000000000001";
const SOFTENG = "10000000-0000-4000-8000-000000000002";
const AI = "10000000-0000-4000-8000-000000000003";
const TERM_ID = "30000000-0000-4000-8000-000000000001";
const REJECTED_ID = "20000000-0000-4000-8000-000000000001";
const PENDING_ID = "20000000-0000-4000-8000-000000000002";

const meeting = (day: number) => ({
  day_of_week: day,
  start_time: "13:30:00",
  end_time: "16:30:00",
  room: "S501",
  type: "lecture",
});

const schedule = {
  term: { year: "2026-2027", semester: "first" },
  courses: [
    {
      section_id: WEBDEV,
      code: "COMP 016",
      title: "Web Development",
      room: "S501",
      faculty_name: "Prof. Reyes",
      units: "3.0",
      meetings: [meeting(0)],
    },
    {
      section_id: SOFTENG,
      code: "COMP 021",
      title: "Software Engineering 1",
      room: null,
      faculty_name: null,
      units: "3.0",
      meetings: [meeting(2)],
    },
  ],
  total_credits: "15.0",
  state: "ready",
  message: null,
};

const available = [
  {
    sectionId: AI,
    courseCode: "COSC 304",
    title: "Introduction to Artificial Intelligence",
    units: "3.0",
    schedule: [{ day: 3, start: "10:30:00", end: "13:30:00", room: null }],
    faculty: null,
    capacity: 40,
    availableSlots: 12,
  },
];

/** The eligibility fields the page reads (API PR #221); the rest are left out. */
function eligibility(isOpen = true) {
  return {
    academicTermId: TERM_ID,
    term: "2026-2027-First Semester",
    addDropPeriod: {
      start: "2026-08-01T00:00:00Z",
      end: "2026-08-22T15:59:59Z",
      isOpen,
    },
  };
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    requestId: PENDING_ID,
    studentId: me.id,
    academicTermId: TERM_ID,
    state: "PENDING",
    unitsBefore: "15.0",
    unitsAfter: "15.0",
    comments: null,
    remarks: null,
    version: 1,
    courses: [
      {
        sectionId: AI,
        courseCode: "COSC 304",
        courseTitle: "Introduction to Artificial Intelligence",
        units: "3.0",
        tag: "PENDING_ADD",
        reason: null,
      },
      {
        sectionId: WEBDEV,
        courseCode: "COMP 016",
        courseTitle: "Web Development",
        units: "3.0",
        tag: "PENDING_DROP",
        reason: "Schedule conflict with work",
      },
    ],
    createdAt: "2026-08-10T02:00:00Z",
    reviewedAt: null,
    reviewedBy: null,
    ...overrides,
  };
}

const rejected = request({
  requestId: REJECTED_ID,
  state: "REJECTED",
  remarks: "COSC 304 is full for your block.",
  reviewedAt: "2026-08-11T03:00:00Z",
  reviewedBy: "40000000-0000-4000-8000-000000000001",
});

function openPage(routes: Parameters<typeof mockApi>[0] = {}) {
  signInDirectly();
  const api = mockApi({
    [ME_ROUTE]: { status: 200, body: me },
    [WINDOW_ROUTE]: { status: 200, body: eligibility() },
    [SCHEDULE_ROUTE]: { status: 200, body: schedule },
    [AVAILABLE_ROUTE]: { status: 200, body: available },
    [LIST_ROUTE]: { status: 200, body: [] },
    ...routes,
  });
  renderApp("/enrollment/add-drop");
  return api;
}

/** Stage a drop and an addition using the current tabbed course browser. */
async function pickChanges(user: ReturnType<typeof userEvent.setup>) {
  const drop = await screen.findByRole("button", { name: "Drop COMP 016" });
  drop.focus();
  await user.keyboard("{Enter}");
  await user.selectOptions(screen.getByRole("combobox", { name: "Reason" }), "Schedule Conflict");
  const available = screen.getByRole("tab", { name: /^Available Courses/ });
  available.focus();
  await user.keyboard("{Enter}");
  const add = await screen.findByRole("button", { name: "Add COSC 304" });
  add.focus();
  await user.keyboard(" ");
}

afterEach(() => {
  session.signOut();
  vi.unstubAllGlobals();
});

describe("AddDropPage (US-ENRL-004)", () => {
  it("shows the enrolled courses, courses to add, and units before and after the change", async () => {
    const user = userEvent.setup();
    const api = openPage();

    expect(await screen.findByText("Web Development")).toBeInTheDocument();
    expect(api.calls.find((call) => call.route === AVAILABLE_ROUTE)).toBeDefined();
    const units = screen.getByRole("region", { name: "Units" });
    expect(within(units).getAllByText("15.0")).toHaveLength(2);

    await pickChanges(user);
    expect(within(units).getAllByText("15.0")).toHaveLength(2);

    // Dropping alone takes the total down; it updates as courses are picked.
    await user.click(screen.getByRole("button", { name: "Remove COSC 304" }));
    expect(within(units).getByText("12.0")).toBeInTheDocument();
  });

  it("searches the courses to add by code or title", async () => {
    const user = userEvent.setup();
    openPage();

    await user.click(await screen.findByRole("tab", { name: /^Available Courses/ }));
    await screen.findByRole("button", { name: "Add COSC 304" });
    await user.type(screen.getByLabelText("Search courses to add"), "thesis");
    expect(screen.queryByRole("button", { name: "Add COSC 304" })).not.toBeInTheDocument();
    expect(screen.getByText("No courses to add match.")).toBeInTheDocument();
  });

  it("AC-ENRL-004.1: sends one request, then tags the courses pending and leaves enrollment as it was", async () => {
    const user = userEvent.setup();
    const api = openPage({
      [CREATE_ROUTE]: { status: 201, body: request() },
      [LIST_ROUTE]: [
        { status: 200, body: [] },
        { status: 200, body: [request()] },
      ],
    });

    await pickChanges(user);
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByText("Request sent. Status: Pending.")).toBeInTheDocument();
    expect(api.called(CREATE_ROUTE)).toHaveLength(1);
    expect(api.called(CREATE_ROUTE)[0].body).toEqual({
      add: [{ sectionId: AI }],
      drop: [{ sectionId: WEBDEV, reason: "Schedule Conflict" }],
      comments: null,
    });
    await user.click(screen.getByRole("tab", { name: /^Currently Enrolled/ }));
    expect(screen.getByText("Pending drop")).toBeInTheDocument();
    expect(screen.getByText("Pending add")).toBeInTheDocument();
    // Still enrolled: the drop waits for a reviewer.
    const enrolled = screen.getByRole("region", { name: "Currently enrolled courses" });
    expect(within(enrolled).getByText("Web Development")).toBeInTheDocument();
    expect(within(enrolled).getByText("Software Engineering 1")).toBeInTheDocument();
    expect(api.called(SCHEDULE_ROUTE)).toHaveLength(1);
  });

  it("asks for a reason before sending a drop", async () => {
    const user = userEvent.setup();
    const api = openPage();

    await user.click(await screen.findByRole("button", { name: "Drop COMP 016" }));
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Select a reason for the courses you drop.",
    );
    expect(api.called(CREATE_ROUTE)).toHaveLength(0);
  });

  it("AC-ENRL-004.3: shows each request's state and a rejection's remarks on the same row", async () => {
    openPage({ [LIST_ROUTE]: { status: 200, body: [rejected, request()] } });

    const rejectedRow = (await screen.findByText("COSC 304 is full for your block.")).closest("tr");
    expect(rejectedRow).not.toBeNull();
    expect(within(rejectedRow as HTMLElement).getByText("Rejected")).toBeInTheDocument();
    expect(within(rejectedRow as HTMLElement).getByText("COSC 304, COMP 016")).toBeInTheDocument();
    // Status and remarks sit in a live region, so a change is read out.
    expect(rejectedRow?.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
  });

  it("AC-ENRL-004.7: replaces the form with the closed notice and the period dates", async () => {
    const user = userEvent.setup();
    openPage({
      [CREATE_ROUTE]: {
        status: 409,
        body: {
          code: "ENROLL_ADD_DROP_PERIOD_CLOSED",
          detail: "Add and drop period is closed.",
          details: {
            periodStart: "2026-08-01T00:00:00+00:00",
            periodEnd: "2026-08-22T15:59:59+00:00",
          },
        },
      },
    });

    await pickChanges(user);
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(
      await screen.findByRole("heading", { name: "Add and drop is closed" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/August 1 - August 22, 2026/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send request" })).not.toBeInTheDocument();
  });

  it("AC-ENRL-004.8: names the minimum load when a drop goes under it", async () => {
    const user = userEvent.setup();
    openPage({
      [CREATE_ROUTE]: {
        status: 409,
        body: {
          code: "ENROLL_BELOW_MINIMUM_LOAD",
          detail: "Dropping this course takes total units (12) below the minimum load of 12 units.",
          details: { minimumLoad: "12", unitsAfter: "12" },
        },
      },
    });

    await pickChanges(user);
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This drop leaves you under the 12-unit minimum.",
    );
  });

  it("AC-ENRL-004.10: shows the enrollment rule's own message for a refused addition", async () => {
    const user = userEvent.setup();
    const api = openPage({
      [CREATE_ROUTE]: {
        status: 409,
        body: {
          code: "ENROLL_PREREQUISITE_NOT_MET",
          detail: "COSC 304 needs COSC 201 first.",
        },
      },
    });

    await user.click(await screen.findByRole("tab", { name: /^Available Courses/ }));
    await user.click(await screen.findByRole("button", { name: "Add COSC 304" }));
    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("COSC 304 needs COSC 201 first.");
    expect(api.called(CREATE_ROUTE)).toHaveLength(1);
    expect(screen.queryByText("Pending add")).not.toBeInTheDocument();
  });

  it("AC-ENRL-004.9: says a request that is not the student's is not available", async () => {
    const user = userEvent.setup();
    openPage({
      [LIST_ROUTE]: { status: 200, body: [request()] },
      [`GET /student/enrollment/add-drop/${PENDING_ID}`]: {
        status: 404,
        body: { code: "RESOURCE_NOT_FOUND", detail: "Resource not found." },
      },
    });

    await user.click(await screen.findByRole("button", { name: /^View request filed/ }));

    expect(await screen.findByText("This request is not available.")).toBeInTheDocument();
  });

  it("opens a request's details with its reasons and remarks", async () => {
    const user = userEvent.setup();
    openPage({
      [LIST_ROUTE]: { status: 200, body: [rejected] },
      [`GET /student/enrollment/add-drop/${REJECTED_ID}`]: { status: 200, body: rejected },
    });

    await user.click(await screen.findByRole("button", { name: /^View request filed/ }));

    const details = await screen.findByRole("region", { name: "Add / Drop Request Details" });
    expect(
      await within(details).findByText("Reason: Schedule conflict with work"),
    ).toBeInTheDocument();
    expect(within(details).getByText("COSC 304 is full for your block.")).toBeInTheDocument();
  });

  it("shows a message for empty and loading states, and a retry for errors", async () => {
    const user = userEvent.setup();
    openPage({
      [SCHEDULE_ROUTE]: [
        { status: 500, body: { detail: "Server error." } },
        { status: 200, body: schedule },
      ],
      [LIST_ROUTE]: { status: 200, body: [] },
    });

    expect(await screen.findByText("Loading your enrolled courses")).toBeInTheDocument();
    expect(await screen.findByText("You have no add and drop requests yet.")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Web Development")).toBeInTheDocument();
  });

  it("AC-ENRL-004.7: shows the closed notice with the dates on load when the period is not open", async () => {
    const api = openPage({ [WINDOW_ROUTE]: { status: 200, body: eligibility(false) } });

    expect(
      await screen.findByRole("heading", { name: "Add and drop is closed" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/August 1 - August 22, 2026/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send request" })).not.toBeInTheDocument();
    expect(api.called(CREATE_ROUTE)).toHaveLength(0);
  });

  it("shows the term and deadline, and asks for courses by the eligibility read's term id", async () => {
    const api = openPage();

    expect(await screen.findByText("Add/Drop Deadline")).toBeInTheDocument();
    expect(await screen.findByText("August 22, 2026")).toBeInTheDocument();
    await screen.findByRole("button", { name: "Drop COMP 016" });
    const fetchMock = vi.mocked(fetch);
    const url = fetchMock.mock.calls
      .map(([input]) => String(input))
      .find((input) => input.includes("available-courses"));
    expect(new URL(url ?? "http://x").searchParams.get("academicTermId")).toBe(TERM_ID);
    expect(api.called(AVAILABLE_ROUTE)).toHaveLength(1);
  });

  it("asks for no courses to add when the eligibility read has no term id", async () => {
    const api = openPage({ [WINDOW_ROUTE]: { status: 200, body: {} } });

    expect(await screen.findByText("Web Development")).toBeInTheDocument();
    expect(screen.getByText("Add/Drop Deadline").nextElementSibling).toHaveTextContent("TBA");
    expect(api.called(AVAILABLE_ROUTE)).toHaveLength(0);
  });

  it("works at 320px wide and passes the axe check", async () => {
    vi.stubGlobal("innerWidth", 320);
    window.dispatchEvent(new Event("resize"));
    const user = userEvent.setup();
    openPage({ [LIST_ROUTE]: { status: 200, body: [rejected] } });

    await screen.findByText("COSC 304 is full for your block.");
    await pickChanges(user);
    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
    await expectNoA11yViolations(document.body);
  });
});
