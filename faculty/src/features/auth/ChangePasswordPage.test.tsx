import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import {
  LOGOUT_ROUTE,
  ME_ROUTE,
  PORTAL_HEADING,
  REFRESH_ROUTE,
  SIGNED_IN_TEXT,
  me,
  refreshedPair,
  signInDirectly,
} from "../../test/fixtures";
import { mockApi } from "../../test/mockApi";
import { renderApp } from "../../test/renderApp";

const ROUTE = "POST /auth/change-password";
const TEMPORARY = "Tmp#7kQ2mZx9pLw4Rt";
const CHOSEN = "my own long passphrase";
const changeRequired = {
  status: 403,
  body: { detail: "Change your temporary password to continue.", code: "PASSWORD_CHANGE_REQUIRED" },
};
const newPair = { access_token: "access-9", refresh_token: "refresh-9", token_type: "bearer" };

const temporaryField = () => screen.getByLabelText(/^Temporary password/);
const newField = () => screen.getByLabelText(/^New password/);

/** A signed-in account with a temporary password, sent to the change by the API's 403. */
async function openChange(routes: Parameters<typeof mockApi>[0] = {}) {
  const api = mockApi({ [ME_ROUTE]: changeRequired, ...routes });
  signInDirectly();
  const router = renderApp("/dashboard");
  await screen.findByRole("heading", { name: "Choose your own password" });
  return { api, router };
}

async function fill(user: ReturnType<typeof userEvent.setup>, temporary = TEMPORARY) {
  await user.type(temporaryField(), temporary);
  await user.type(newField(), `${CHOSEN}{Enter}`);
}

afterEach(async () => {
  mockApi({ [LOGOUT_ROUTE]: { status: 204 } });
  await session.signOut();
  vi.unstubAllGlobals();
});

describe("first sign-in password change", () => {
  it("opens when the API says the temporary password must change, focused on its heading", async () => {
    const { router } = await openChange();

    expect(screen.getByRole("heading", { name: "Choose your own password" })).toHaveFocus();
    expect(router.state.location.pathname).toBe("/change-password");
    expect(temporaryField()).toHaveAttribute("autocomplete", "current-password");
    expect(newField()).toHaveAttribute("autocomplete", "new-password");
  });

  it("changes the password, confirms it, then opens the portal on the new session", async () => {
    const { api, router } = await openChange({
      [ROUTE]: { status: 200, body: newPair },
      [ME_ROUTE]: [changeRequired, { status: 200, body: me }],
    });
    const user = userEvent.setup();

    await fill(user);

    expect(await screen.findByRole("heading", { name: "Password changed" })).toHaveFocus();
    expect(api.called(ROUTE)[0]).toMatchObject({
      authorization: "Bearer access-1",
      body: { current_password: TEMPORARY, new_password: CHOSEN },
    });
    expect(await screen.findByText(SIGNED_IN_TEXT, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/Your password has been changed/)).toHaveAttribute("role", "status");
    expect(router.state.location.pathname).toBe("/dashboard");
    expect(api.called(ME_ROUTE).at(-1)?.authorization).toBe("Bearer access-9");
  });

  it("lists the rules and will not send a new password equal to the temporary one", async () => {
    const { api } = await openChange();
    const user = userEvent.setup();

    await user.type(temporaryField(), TEMPORARY);
    await user.type(newField(), `${TEMPORARY}{Enter}`);

    expect(
      screen.getByText("Different from your temporary password").closest("li"),
    ).toHaveAttribute("data-met", "false");
    expect(screen.getByText("At least 12 characters").closest("li")).toHaveAttribute(
      "data-met",
      "true",
    );
    expect(newField()).toHaveFocus();
    expect(api.called(ROUTE)).toHaveLength(0);
  });

  it("moves focus to the first empty field on submit", async () => {
    const { api } = await openChange();
    const user = userEvent.setup();

    await user.type(newField(), `${CHOSEN}{Enter}`);

    expect(temporaryField()).toHaveFocus();
    expect(temporaryField()).toHaveAccessibleDescription(/Enter your temporary password/);
    expect(api.called(ROUTE)).toHaveLength(0);
  });

  it("says the temporary password is wrong, clears both passwords, and focuses it", async () => {
    const wrong = {
      status: 401,
      body: { detail: "Current password is incorrect", request_id: "req-cur" },
    };
    const { api } = await openChange({
      [ROUTE]: wrong,
      [REFRESH_ROUTE]: { status: 200, body: refreshedPair },
    });
    const user = userEvent.setup();

    await fill(user, "not-it");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("That temporary password is not correct.");
    expect(alert).toHaveTextContent("Reference: req-cur");
    expect(temporaryField()).toHaveValue("");
    expect(newField()).toHaveValue("");
    expect(temporaryField()).toHaveFocus();
    expect(newField()).not.toHaveAccessibleDescription(/Enter a new password/);
    // The 401 could have been an expired access token; the refresh ruled that out.
    expect(api.called(REFRESH_ROUTE)).toHaveLength(1);
  });

  it("offers a reset when the temporary password has expired", async () => {
    await openChange({
      [ROUTE]: {
        status: 401,
        body: { detail: "x", request_id: "req-exp", code: "AUTH_TEMPORARY_PASSWORD_EXPIRED" },
      },
      [REFRESH_ROUTE]: { status: 200, body: refreshedPair },
    });

    await fill(userEvent.setup());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your temporary password has expired.");
    expect(screen.getByRole("link", { name: "Reset your password" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  it("explains a refused new password and returns focus to it", async () => {
    await openChange({
      [ROUTE]: { status: 422, body: { detail: "x", code: "AUTH_PASSWORD_TOO_WEAK" } },
    });

    await fill(userEvent.setup());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That password does not meet every rule in the list.",
    );
    expect(newField()).toHaveFocus();
  });

  it("signs out from the change screen on request", async () => {
    const api = (await openChange({ [LOGOUT_ROUTE]: { status: 204 } })).api;

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("heading", { name: PORTAL_HEADING })).toBeInTheDocument();
    await waitFor(() => expect(api.called(LOGOUT_ROUTE)).toHaveLength(1));
  });

  it("sends a signed-out visitor to sign-in, since the change needs a session", async () => {
    mockApi({});
    const router = renderApp("/change-password");

    expect(await screen.findByRole("heading", { name: PORTAL_HEADING })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });
});
