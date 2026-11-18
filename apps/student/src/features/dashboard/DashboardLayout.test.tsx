import { mockApi } from "@cbpupsis/account/testing";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { me, ME_ROUTE, signInDirectly } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";

const DASHBOARD_ROUTE = "GET /student/dashboard";

function dashboard(student: Record<string, unknown> = {}) {
  return {
    status: "success",
    data: {
      student: {
        student_number: "2021-00456-MN-0",
        name: "Juan Dela Cruz",
        programme: "BS Computer Science",
        year_level: 3,
        enrollment_status: "ENROLLED",
        avatar_url: null,
        ...student,
      },
      current_term: { id: "t0", academic_year: "", semester: "", is_current: true },
      holds: [],
      standing: { value: "GOOD", unit_reduction: 0 },
      enrollment: { enrolled_units: "0", effective_ceiling: "0", prescribed_load: "0" },
      periods: [],
      announcements: [],
      events: [],
      recent_activity: [],
      empty_states: { announcements: null, events: null, recent_activity: null },
    },
  };
}

async function openAccountMenu() {
  const user = userEvent.setup();
  const trigger = await screen.findByRole("button", { name: "Account menu for Juan Dela Cruz" });
  await user.click(trigger);
  return user;
}

afterEach(async () => {
  mockApi({ "POST /auth/student/logout": { status: 204 } });
  await session.signOut();
  vi.unstubAllGlobals();
});

describe("header account menu", () => {
  it("shows the signed-in student's first name and opens to their full identity", async () => {
    signInDirectly();
    mockApi({
      [ME_ROUTE]: { status: 200, body: me },
      [DASHBOARD_ROUTE]: { status: 200, body: dashboard() },
    });
    renderApp("/dashboard");

    expect(await screen.findByText("Juan")).toBeInTheDocument();
    await openAccountMenu();

    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("2021-00456-MN-0")).toBeInTheDocument();
    expect(screen.getByText(me.email)).toBeInTheDocument();
  });

  it("opens the profile, and marks itself current there", async () => {
    signInDirectly();
    mockApi({
      [ME_ROUTE]: { status: 200, body: me },
      [DASHBOARD_ROUTE]: { status: 200, body: dashboard() },
      "GET /student/profile": {
        status: 200,
        body: {
          studentId: "2021-00456-MN-0",
          avatarUrl: null,
          fields: { firstName: { value: "Juan", editable: false } },
        },
      },
      "GET /student/profile/emergency-contacts": { status: 200, body: [] },
    });
    const router = renderApp("/dashboard");
    const user = await openAccountMenu();

    const profileLink = screen.getByRole("link", { name: "Profile" });
    expect(profileLink).not.toHaveAttribute("aria-current");
    await user.click(profileLink);

    expect(await screen.findByRole("heading", { name: "Student Profile" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/profile");

    await openAccountMenu();
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    signInDirectly();
    mockApi({
      [ME_ROUTE]: { status: 200, body: me },
      [DASHBOARD_ROUTE]: { status: 200, body: dashboard() },
    });
    renderApp("/dashboard");
    const user = await openAccountMenu();

    expect(screen.getByText(me.email)).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(screen.queryByText(me.email)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu for Juan Dela Cruz" })).toHaveFocus();
  });

  it("keeps Sign out as its own menu item, distinct from the links", async () => {
    signInDirectly();
    mockApi({
      [ME_ROUTE]: { status: 200, body: me },
      [DASHBOARD_ROUTE]: { status: 200, body: dashboard() },
    });
    renderApp("/dashboard");
    await openAccountMenu();

    const signOut = screen.getByRole("button", { name: "Logout" });
    expect(signOut).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Logout" })).not.toBeInTheDocument();
  });

  it("announces the signed-in account for assistive tech, independent of the dashboard request", async () => {
    signInDirectly();
    // No dashboard route mocked: the sign-in announcement must not depend on it.
    mockApi({ [ME_ROUTE]: { status: 200, body: me } });
    renderApp("/dashboard");

    expect(await screen.findByText(`Signed in as ${me.email}`)).toBeInTheDocument();
  });
});
