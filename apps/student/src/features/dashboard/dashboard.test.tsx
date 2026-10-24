import { mockApi } from "@cbpupsis/account/testing";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { me, ME_ROUTE, signInDirectly } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";

const DASHBOARD_ROUTE = "GET /student/me/dashboard";

function dashboard(data: Record<string, unknown> = {}) {
  return {
    status: "success",
    data: {
      student: {
        student_number: "2021-00456-MN-0",
        name: "Maria Clara Santos",
        programme: "BS Computer Science",
        year_level: 3,
        enrollment_status: "ENROLLED",
        avatar_url: null,
      },
      current_term: { id: "t1", academic_year: "2026-2027", semester: "first", is_current: true },
      holds: [],
      standing: { value: "GOOD", unit_reduction: 0 },
      enrollment: { enrolled_units: "21.0", effective_ceiling: "24.0", prescribed_load: "21.0" },
      periods: [],
      announcements: [
        {
          id: "a1",
          title: "Enrollment opens August 1",
          body: "Check your assessment before you enroll.",
          category: "ACADEMIC",
          published_at: "2026-07-20T01:00:00Z",
          expires_at: null,
          is_pinned: false,
        },
      ],
      events: [
        {
          id: "e1",
          title: "Start of classes",
          starts_at: "2026-08-17T00:00:00+08:00",
          ends_at: "2026-08-17T23:59:00+08:00",
          is_multi_day: false,
          category: "ACADEMIC_CALENDAR",
          description: "All year levels.",
        },
      ],
      recent_activity: [
        {
          id: "r1",
          occurred_at: "2026-07-21T09:15:00+08:00",
          type: "LOGIN_FAILED",
          severity: "WARNING",
          description: "Failed sign-in attempt",
        },
      ],
      empty_states: { announcements: null, events: null, recent_activity: null },
      ...data,
    },
  };
}

function openDashboard(routes: Parameters<typeof mockApi>[0] = {}) {
  signInDirectly();
  const api = mockApi({
    [ME_ROUTE]: { status: 200, body: me },
    [DASHBOARD_ROUTE]: { status: 200, body: dashboard() },
    ...routes,
  });
  renderApp("/dashboard");
  return api;
}

afterEach(async () => {
  mockApi({ "POST /auth/student/logout": { status: 204 } });
  await session.signOut();
  vi.unstubAllGlobals();
});

describe("student dashboard", () => {
  it("shows what the API returns, from one request with the session's token", async () => {
    const api = openDashboard();

    expect(
      await screen.findByRole("heading", { name: "Welcome back, Maria Clara Santos!" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Academic Year 2026-2027")).toBeInTheDocument();
    expect(screen.getByText("First Semester")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Enrollment opens August 1" })).toBeInTheDocument();
    expect(screen.getByText("Start of classes")).toBeInTheDocument();
    expect(screen.getByText("August 17, 2026")).toBeInTheDocument();
    expect(screen.getByText("Failed sign-in attempt")).toBeInTheDocument();
    expect(screen.getByText(/Needs attention/)).toBeInTheDocument();

    // The page and the sidebar share one request.
    const calls = api.called(DASHBOARD_ROUTE);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.authorization).toBe("Bearer access-1");
  });

  it("shows no sample data: an empty account reads as empty, in the API's words", async () => {
    openDashboard({
      [DASHBOARD_ROUTE]: {
        status: 200,
        body: dashboard({
          student: {
            student_number: "2021-00456-MN-0",
            name: "2021-00456-MN-0",
            programme: "",
            year_level: 1,
            enrollment_status: "NOT_ENROLLED",
          },
          current_term: { id: "t0", academic_year: "", semester: "", is_current: true },
          announcements: [],
          events: [],
          recent_activity: [],
          empty_states: {
            announcements: "No announcements at this time.",
            events: "No upcoming events on the academic calendar.",
            recent_activity:
              "Your account activity will appear here once you begin using the portal.",
          },
        }),
      },
    });

    expect(await screen.findByText("No announcements at this time.")).toBeInTheDocument();
    expect(screen.getByText("No upcoming events on the academic calendar.")).toBeInTheDocument();
    expect(
      screen.getByText("Your account activity will appear here once you begin using the portal."),
    ).toBeInTheDocument();
    // No name on record: a plain greeting, never the student number.
    expect(screen.getByRole("heading", { name: "Welcome back!" })).toBeInTheDocument();
    expect(screen.queryByText(/Academic Year/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dela Cruz/)).not.toBeInTheDocument();
  });

  it("explains a failure once, and loads the page on retry", async () => {
    const api = openDashboard({
      [DASHBOARD_ROUTE]: [
        { status: 500, body: { detail: "Internal error", request_id: "req-1" } },
        { status: 200, body: dashboard() },
      ],
    });

    const alert = await screen.findByRole("alert");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    await userEvent.click(within(alert).getByRole("button", { name: /try again/i }));

    expect(
      await screen.findByRole("heading", { name: "Welcome back, Maria Clara Santos!" }),
    ).toBeInTheDocument();
    expect(api.called(DASHBOARD_ROUTE).length).toBeGreaterThanOrEqual(2);
  });
});
