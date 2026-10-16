import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { LOGOUT_ROUTE, PORTAL_HEADING } from "../../test/fixtures";
import { mockApi } from "../../test/mockApi";
import { renderApp } from "../../test/renderApp";

const ROUTE = "POST /auth/forgot-password";
const accepted = {
  status: 202,
  body: { message: "If that address is registered, a reset link has been sent." },
};

async function openPage() {
  renderApp("/forgot-password");
  return screen.findByRole("heading", { name: "Reset your password" });
}

const emailField = () => screen.getByRole("textbox", { name: /email address/i });

afterEach(async () => {
  mockApi({ [LOGOUT_ROUTE]: { status: 204 } });
  await session.signOut();
  vi.unstubAllGlobals();
});

describe("forgot password (US-105)", () => {
  it("opens from the sign-in page in place of the old email link, focused on its heading", async () => {
    mockApi({});
    renderApp("/");
    await screen.findByRole("heading", { name: PORTAL_HEADING });

    await userEvent.click(screen.getByRole("link", { name: "Forgot password?" }));

    expect(await screen.findByRole("heading", { name: "Reset your password" })).toHaveFocus();
  });

  it("sends the email address, then confirms on a new step with its heading focused", async () => {
    const api = mockApi({ [ROUTE]: accepted });
    await openPage();
    const user = userEvent.setup();

    await user.type(emailField(), "  ana@pup.edu.ph{Enter}");

    expect(await screen.findByRole("heading", { name: "Check your email" })).toHaveFocus();
    expect(api.called(ROUTE)[0].body).toEqual({ email: "ana@pup.edu.ph" });
    expect(screen.getByText("ana@pup.edu.ph")).toBeInTheDocument();
  });

  it("never shows the API's wording, so the confirmation is the same for every address", async () => {
    mockApi({ [ROUTE]: accepted });
    await openPage();

    await userEvent.type(emailField(), "nobody@example.com{Enter}");

    await screen.findByRole("heading", { name: "Check your email" });
    expect(screen.queryByText(/registered/)).not.toBeInTheDocument();
    expect(screen.getByText(/belongs to a CBPUPSIS account/)).toBeInTheDocument();
  });

  it("checks the address when the field is left, then on every keystroke", async () => {
    const api = mockApi({});
    await openPage();
    const user = userEvent.setup();

    await user.type(emailField(), "ana@");
    expect(emailField()).not.toHaveAccessibleDescription(/valid email/);
    await user.tab();
    expect(emailField()).toHaveAccessibleDescription(/Enter a valid email address/);

    await user.type(emailField(), "pup.edu.ph");
    expect(emailField()).not.toHaveAccessibleDescription(/valid email/);
    expect(api.calls).toHaveLength(0);
  });

  it("moves focus to an empty field on submit instead of calling the API", async () => {
    const api = mockApi({});
    await openPage();

    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(emailField()).toHaveFocus();
    expect(emailField()).toHaveAccessibleDescription(/Enter your email address/);
    expect(api.calls).toHaveLength(0);
  });

  it("shows the API's refusal of a malformed address on the field, keeping what was typed", async () => {
    mockApi({
      [ROUTE]: {
        status: 400,
        body: { detail: "Enter a valid email address.", code: "INVALID_EMAIL_ADDRESS" },
      },
    });
    await openPage();

    await userEvent.type(emailField(), "ana@pup.edu.ph{Enter}");

    await waitFor(() =>
      expect(emailField()).toHaveAccessibleDescription(/Enter a valid email address/),
    );
    expect(emailField()).toHaveValue("ana@pup.edu.ph");
  });

  it("explains a refused request, with the wait and the reference, and blocks resending", async () => {
    mockApi({
      [ROUTE]: {
        status: 429,
        headers: { "Retry-After": "120" },
        body: { detail: "Too many requests.", request_id: "req-7", code: "RATE_LIMIT_EXCEEDED" },
      },
    });
    await openPage();

    await userEvent.type(emailField(), "ana@pup.edu.ph{Enter}");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Too many reset requests/);
    expect(alert).toHaveTextContent("Reference: req-7");
    await waitFor(() => expect(screen.getByRole("timer")).toHaveTextContent(/^(2:00|1:59)$/));
    expect(screen.getByRole("button", { name: "Send reset link" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("keeps the address after a dropped connection so one more tap retries", async () => {
    const api = mockApi({ [ROUTE]: ["offline", accepted] });
    await openPage();
    const user = userEvent.setup();

    await user.type(emailField(), "ana@pup.edu.ph{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not reach the server/);
    expect(emailField()).toHaveValue("ana@pup.edu.ph");

    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(api.called(ROUTE)).toHaveLength(2);
  });

  it("shows the request in flight on the button itself and ignores a second press", async () => {
    const api = mockApi({ [ROUTE]: "pending" });
    await openPage();
    const user = userEvent.setup();

    await user.type(emailField(), "ana@pup.edu.ph{Enter}");
    const button = screen.getByRole("button", { name: "Send reset link" });
    await waitFor(() => expect(button).toHaveAttribute("aria-disabled", "true"));
    await user.click(button);

    expect(api.called(ROUTE)).toHaveLength(1);
  });

  it("sends another link on request and says so", async () => {
    const api = mockApi({ [ROUTE]: accepted });
    await openPage();
    const user = userEvent.setup();
    await user.type(emailField(), "ana@pup.edu.ph{Enter}");
    await screen.findByRole("heading", { name: "Check your email" });

    await user.click(screen.getByRole("button", { name: "Send another link" }));

    expect(await screen.findByText("Another link was sent to ana@pup.edu.ph.")).toHaveAttribute(
      "role",
      "status",
    );
    expect(api.called(ROUTE)).toHaveLength(2);
  });
});
