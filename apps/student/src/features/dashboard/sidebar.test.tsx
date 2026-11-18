import { mockApi } from "@cbpupsis/account/testing";
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { me, ME_ROUTE, signInDirectly } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";

afterEach(async () => {
  mockApi({ "POST /auth/student/logout": { status: 204 } });
  await session.signOut();
  vi.unstubAllGlobals();
});

describe("sidebar", () => {
  it("holds only Dashboard, Academics, Finance, Forms & Requests, and Help & Support", async () => {
    signInDirectly();
    mockApi({ [ME_ROUTE]: { status: 200, body: me } });
    renderApp("/settings");

    const nav = await screen.findByRole("navigation", { name: "Student modules" });
    const labels = [...within(nav).getAllByRole("link"), ...within(nav).getAllByRole("button")].map(
      (item) => item.getAttribute("aria-label"),
    );

    expect(labels).toEqual(
      expect.arrayContaining([
        "Dashboard",
        "Academics",
        "Finance",
        "Forms & Requests",
        "Help & Support: email portal support",
      ]),
    );
    expect(within(nav).queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();
    expect(within(nav).queryByText("Change Password")).not.toBeInTheDocument();
  });
});
