import { mockApi } from "@cbpupsis/account/testing";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { me, ME_ROUTE, REFRESH_ROUTE, refreshedPair, signInDirectly } from "../../test/fixtures";
import { renderApp } from "../../test/renderApp";

const CHANGE_ROUTE = "POST /auth/change-password";
const CURRENT = "my current passphrase";
const CHOSEN = "my brand new long passphrase";
const newPair = { access_token: "access-9", refresh_token: "refresh-9", token_type: "bearer" };

const currentField = () => screen.getByLabelText(/^Current password/);
const newField = () => screen.getByLabelText(/^New password/);

afterEach(async () => {
  mockApi({ "POST /auth/student/logout": { status: 204 } });
  await session.signOut();
  vi.unstubAllGlobals();
});

describe("settings page", () => {
  it("sends a signed-out visitor to sign-in", async () => {
    mockApi({});
    const router = renderApp("/settings");

    expect(await screen.findByRole("heading", { name: "Hello, Iskolar." })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("changes the password and keeps the student signed in on the new session", async () => {
    signInDirectly();
    const api = mockApi({
      [ME_ROUTE]: { status: 200, body: me },
      [CHANGE_ROUTE]: { status: 200, body: newPair },
    });
    const router = renderApp("/settings");
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "Change Password" });
    await user.type(currentField(), CURRENT);
    await user.type(newField(), `${CHOSEN}{Enter}`);

    expect(await screen.findByText("Your password was changed.")).toBeInTheDocument();
    expect(api.called(CHANGE_ROUTE)[0]).toMatchObject({
      authorization: "Bearer access-1",
      body: { current_password: CURRENT, new_password: CHOSEN },
    });
    expect(router.state.location.pathname).toBe("/settings");
    expect(session.isSignedIn()).toBe(true);
    expect(currentField()).toHaveValue("");
    expect(newField()).toHaveValue("");
  });

  it("asks for both fields before sending anything", async () => {
    signInDirectly();
    const api = mockApi({ [ME_ROUTE]: { status: 200, body: me } });
    renderApp("/settings");
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "Change Password" });
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("Enter your current password.")).toBeInTheDocument();
    expect(currentField()).toHaveFocus();
    expect(api.called(CHANGE_ROUTE)).toHaveLength(0);
  });

  it("refuses a new password that is too short, without calling the API", async () => {
    signInDirectly();
    const api = mockApi({ [ME_ROUTE]: { status: 200, body: me } });
    renderApp("/settings");
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "Change Password" });
    await user.type(currentField(), CURRENT);
    await user.type(newField(), "short{Enter}");

    expect(
      await screen.findByText("Your new password does not meet every rule yet."),
    ).toBeInTheDocument();
    expect(newField()).toHaveFocus();
    expect(api.called(CHANGE_ROUTE)).toHaveLength(0);
  });

  it("shows the API's refusal of a wrong current password and empties the fields", async () => {
    signInDirectly();
    mockApi({
      [ME_ROUTE]: { status: 200, body: me },
      [CHANGE_ROUTE]: { status: 401, body: { detail: "Current password is incorrect." } },
      // The 401 could have been an expired access token; the refresh rules that out.
      [REFRESH_ROUTE]: { status: 200, body: refreshedPair },
    });
    renderApp("/settings");
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "Change Password" });
    await user.type(currentField(), CURRENT);
    await user.type(newField(), `${CHOSEN}{Enter}`);

    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect.");
    expect(currentField()).toHaveValue("");
    expect(newField()).toHaveValue("");
    expect(currentField()).toHaveFocus();
  });
});
