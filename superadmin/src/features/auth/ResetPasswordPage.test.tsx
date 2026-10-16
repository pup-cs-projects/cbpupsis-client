import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { LOGOUT_ROUTE, PORTAL_HEADING } from "../../test/fixtures";
import { mockApi } from "../../test/mockApi";
import { renderApp } from "../../test/renderApp";

const ROUTE = "POST /auth/reset-password";
const TOKEN = "mailed-token_123";
const validLink = {
  status: 200,
  body: {
    valid: true,
    minimumLength: 8,
    requiredRules: ["uppercase", "lowercase", "digit", "symbol"],
  },
};
const refusal = (status: number, code: string | undefined, requestId = "req-1") => ({
  status,
  body: { detail: "Not shown to people", request_id: requestId, ...(code ? { code } : {}) },
});

const passwordField = () => screen.getByLabelText(/^New password/);
const rule = (label: string) => screen.getByText(label).closest("li");

async function openForm() {
  renderApp(`/reset-password?token=${TOKEN}`);
  return screen.findByRole("heading", { name: "Choose a new password" });
}

afterEach(async () => {
  mockApi({ [LOGOUT_ROUTE]: { status: 204 } });
  await session.signOut();
  vi.unstubAllGlobals();
});

describe("reset password (US-105)", () => {
  it("checks the link on load without spending it, then asks for the password once", async () => {
    const api = mockApi({ [ROUTE]: validLink });

    expect(await openForm()).toHaveFocus();
    expect(api.called(ROUTE)[0].body).toEqual({ token: TOKEN, verify_only: true });
    expect(screen.getAllByLabelText(/password/i, { selector: "input" })).toHaveLength(1);
    expect(passwordField()).toHaveAttribute("autocomplete", "new-password");
  });

  it("lists the API's rules and ticks each one as the password is typed", async () => {
    mockApi({ [ROUTE]: validLink });
    await openForm();
    const user = userEvent.setup();

    expect(rule("At least 8 characters")).toHaveAttribute("data-met", "false");
    await user.type(passwordField(), "abc");
    expect(rule("A lowercase letter")).toHaveAttribute("data-met", "true");
    expect(rule("An uppercase letter")).toHaveAttribute("data-met", "false");
    expect(rule("A lowercase letter")).toHaveTextContent("A lowercase letter: done");

    await user.type(passwordField(), "Def1!x");
    expect(screen.getAllByRole("listitem").every((item) => item.dataset.met === "true")).toBe(true);
    expect(screen.getByText("Your password meets every rule.")).toBeInTheDocument();
  });

  it("shows the password on request instead of asking for it twice", async () => {
    mockApi({ [ROUTE]: validLink });
    await openForm();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Show new password" }));

    expect(passwordField()).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide new password" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps a password that misses a rule on this side and moves focus to it", async () => {
    const api = mockApi({ [ROUTE]: validLink });
    await openForm();
    const user = userEvent.setup();

    await user.type(passwordField(), "abcdefgh{Enter}");

    expect(passwordField()).toHaveFocus();
    expect(passwordField()).toHaveAccessibleDescription(/does not meet every rule yet/);
    expect(api.called(ROUTE)).toHaveLength(1);
  });

  it("sets the password, confirms it, then says on sign-in that every other session ended (AC-105.6)", async () => {
    const api = mockApi({
      [ROUTE]: [validLink, { status: 200, body: { sessionsRevoked: 3 } }],
    });
    const router = renderApp(`/reset-password?token=${TOKEN}`);
    await screen.findByRole("heading", { name: "Choose a new password" });

    await userEvent.type(passwordField(), "Abcdef1!{Enter}");

    expect(await screen.findByRole("heading", { name: "Password changed" })).toHaveFocus();
    expect(api.called(ROUTE)[1].body).toEqual({ token: TOKEN, new_password: "Abcdef1!" });
    expect(
      await screen.findByText(/every other session was signed out/, {}, { timeout: 3000 }),
    ).toHaveAttribute("role", "status");
    expect(screen.getByRole("heading", { name: PORTAL_HEADING })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("explains a password the API calls too weak, clears it, and returns focus to it (AC-105.3)", async () => {
    mockApi({
      [ROUTE]: [validLink, refusal(422, "AUTH_PASSWORD_TOO_WEAK", "req-weak")],
    });
    await openForm();

    await userEvent.type(passwordField(), "Abcdef1!{Enter}");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("That password does not meet every rule in the list.");
    expect(alert).toHaveTextContent("Reference: req-weak");
    expect(alert).not.toHaveTextContent("Not shown to people");
    expect(passwordField()).toHaveValue("");
    expect(passwordField()).toHaveFocus();
  });

  it("says an expired link has expired and offers a new one", async () => {
    mockApi({ [ROUTE]: refusal(410, "AUTH_RESET_TOKEN_EXPIRED", "req-old") });
    renderApp(`/reset-password?token=${TOKEN}`);

    expect(await screen.findByRole("heading", { name: "This link has expired" })).toHaveFocus();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("That link has expired. Request a new one below.");
    expect(alert).toHaveTextContent("Reference: req-old");
    expect(screen.getByRole("link", { name: "Request a new link" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  it("says a used link was used, when it is spent between loading and submitting", async () => {
    mockApi({ [ROUTE]: [validLink, refusal(410, "AUTH_RESET_TOKEN_USED")] });
    await openForm();

    await userEvent.type(passwordField(), "Abcdef1!{Enter}");

    expect(await screen.findByRole("heading", { name: "This link has been used" })).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("That link has already been used.");
  });

  it("calls a link the API does not know not valid, with the reference", async () => {
    mockApi({ [ROUTE]: refusal(401, undefined, "req-unknown") });
    renderApp(`/reset-password?token=${TOKEN}`);

    expect(await screen.findByRole("heading", { name: "This link cannot be used" })).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("That link is not valid.");
    expect(screen.getByRole("alert")).toHaveTextContent("Reference: req-unknown");
  });

  it("treats a link without a token as not valid, without calling the API", async () => {
    const api = mockApi({});
    renderApp("/reset-password");

    expect(await screen.findByRole("heading", { name: "This link cannot be used" })).toBeVisible();
    expect(api.calls).toHaveLength(0);
  });

  it("offers a retry when the link could not be checked, and continues when it can", async () => {
    mockApi({ [ROUTE]: ["offline", "offline", validLink] });
    renderApp(`/reset-password?token=${TOKEN}`);

    // One automatic retry first, for a dropped connection on weak signal.
    expect(
      await screen.findByRole(
        "heading",
        { name: "We could not check your link" },
        { timeout: 3000 },
      ),
    ).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Choose a new password" })).toBeInTheDocument(),
    );
  });

  it("is open without signing in", async () => {
    mockApi({ [ROUTE]: validLink });
    const router = renderApp(`/reset-password?token=${TOKEN}`);

    await screen.findByRole("heading", { name: "Choose a new password" });
    expect(router.state.location.pathname).toBe("/reset-password");
  });
});
