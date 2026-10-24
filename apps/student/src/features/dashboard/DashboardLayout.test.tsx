import { mockApi } from "@cbpupsis/account/testing";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { me, ME_ROUTE, signInDirectly } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";

const field = (value: string | null, editable = false) => ({ value, editable });

const profile = {
  studentId: "2021-00456-MN-0",
  avatarUrl: null,
  petitionRoute: "/api/v1/student/petitions/record-correction",
  fields: { studentId: field("2021-00456-MN-0"), firstName: field("Juan") },
  emergencyContacts: [],
};

afterEach(async () => {
  mockApi({ "POST /auth/student/logout": { status: 204 } });
  await session.signOut();
  vi.unstubAllGlobals();
});

describe("sidebar account card", () => {
  it("opens the profile, and marks itself current there", async () => {
    signInDirectly();
    mockApi({
      [ME_ROUTE]: { status: 200, body: me },
      "GET /student/profile": { status: 200, body: profile },
      "GET /student/profile/emergency-contacts": { status: 200, body: [] },
    });
    const router = renderApp("/dashboard");

    const card = await screen.findByRole("link", { name: "Your profile" });
    expect(card).not.toHaveAttribute("aria-current");
    await userEvent.click(card);

    expect(await screen.findByRole("heading", { name: "Student Profile" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/profile");
    expect(screen.getByRole("link", { name: "Your profile" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps Sign out as its own button beside the card", async () => {
    signInDirectly();
    mockApi({ [ME_ROUTE]: { status: 200, body: me } });
    renderApp("/dashboard");

    const card = await screen.findByRole("link", { name: "Your profile" });
    const signOut = screen.getAllByRole("button", { name: "Sign out" }).at(-1);

    expect(signOut).toBeDefined();
    expect(card).not.toContainElement(signOut ?? null);
  });
});
