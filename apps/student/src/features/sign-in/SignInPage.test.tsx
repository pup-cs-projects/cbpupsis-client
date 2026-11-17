import { mockApi } from "@cbpupsis/account/testing";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { renderApp } from "../../test/renderApp";

const tokens = {
  access_token: "access-1",
  refresh_token: "refresh-1",
  token_type: "bearer",
  role: "student",
  expires_in: 900,
};
const me = {
  id: "6f1c1e8e-0000-4000-8000-000000000001",
  email: "juan@iskolarngbayan.pup.edu.ph",
  role: "student",
};

// The API's own sentences (cbpupsis_shared/domains/auth/constants.py).
const FAILED = "Invalid credentials. Please verify your Student ID, birthdate, and password.";
const TEMPORARY_EXPIRED =
  "Your temporary password has expired. Ask the system administrator to issue a new one.";

async function fillAndSubmit(
  details = {
    studentNumber: "2021-00123-MN-0",
    birthdate: "2003-04-05",
    password: "correct horse",
  },
) {
  const user = userEvent.setup();
  if (details.studentNumber)
    await user.type(screen.getByLabelText(/student id number/i), details.studentNumber);
  if (details.birthdate) {
    const [year, month, day] = details.birthdate.split("-").map(Number);
    await user.selectOptions(screen.getByLabelText("Birth month"), String(month));
    await user.selectOptions(screen.getByLabelText("Birth day"), String(day));
    await user.selectOptions(screen.getByLabelText("Birth year"), String(year));
  }
  if (details.password) await user.type(screen.getByLabelText(/^Password/), details.password);
  await user.click(screen.getByRole("button", { name: "Sign in to Portal" }));
  return user;
}

afterEach(async () => {
  // The session is the app's singleton; end it so no test starts signed in.
  mockApi({ "POST /auth/student/logout": { status: 204 } });
  await session.signOut();
  vi.unstubAllGlobals();
});

describe("student sign-in (US-101)", () => {
  it("signs in with student number, birthdate, and password, then shows the student's account (AC-101.1)", async () => {
    const api = mockApi({
      "POST /auth/student/login": { status: 200, body: tokens },
      "GET /auth/student/me": { status: 200, body: me },
    });
    renderApp("/");
    await screen.findByRole("heading", { name: "Hello, Iskolar." });

    await fillAndSubmit();

    expect(await screen.findByText(`Signed in as ${me.email}`)).toBeInTheDocument();
    expect(api.called("POST /auth/student/login")[0].body).toEqual({
      student_number: "2021-00123-MN-0",
      birthdate: "2003-04-05",
      password: "correct horse",
    });
    expect(api.called("GET /auth/student/me")[0].authorization).toBe("Bearer access-1");
  });

  it("requires the birthdate, as every student sign-in does, without calling the API", async () => {
    const api = mockApi({});
    renderApp("/");
    await screen.findByRole("heading", { name: "Hello, Iskolar." });

    await fillAndSubmit({ studentNumber: "2021-00123-MN-0", birthdate: "", password: "pw" });

    expect(screen.getByText("Please complete all fields to sign in.")).toBeInTheDocument();
    expect(screen.getByLabelText("Birth month")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Birth month")).toHaveFocus();
    expect(api.calls).toHaveLength(0);
  });

  it("rejects a birthdate the calendar doesn't have without calling the API", async () => {
    const api = mockApi({});
    renderApp("/");
    await screen.findByRole("heading", { name: "Hello, Iskolar." });

    await fillAndSubmit({
      studentNumber: "2021-00123-MN-0",
      birthdate: "2003-04-31",
      password: "pw",
    });

    expect(screen.getByText("Choose a date that exists.")).toBeInTheDocument();
    expect(screen.getByLabelText("Birth day")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Birth day")).toHaveFocus();
    expect(api.calls).toHaveLength(0);
  });

  it("shows a malformed student number as an error on that field (AC-101.2)", async () => {
    mockApi({
      "POST /auth/student/login": {
        status: 422,
        body: {
          detail: "Invalid Student ID format.",
          request_id: "r1",
          code: "AUTH_ID_FORMAT_INVALID",
        },
      },
    });
    renderApp("/");
    await screen.findByRole("heading", { name: "Hello, Iskolar." });

    await fillAndSubmit({ studentNumber: "21-123", birthdate: "2003-04-05", password: "pw" });

    expect(await screen.findByLabelText(/student id number/i)).toHaveAccessibleDescription(
      "Invalid Student ID format.",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says only what the API says about the failed details, clears the password, and stays on sign-in (AC-101.3)", async () => {
    mockApi({
      "POST /auth/student/login": {
        status: 401,
        body: {
          status: "error",
          message: FAILED,
          detail: FAILED,
          request_id: "req-42",
          code: "AUTH_FAILED",
        },
      },
    });
    renderApp("/");
    await screen.findByRole("heading", { name: "Hello, Iskolar." });

    await fillAndSubmit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(FAILED);
    expect(alert).toHaveTextContent("req-42");
    expect(screen.getByLabelText(/^Password/)).toHaveValue("");
  });

  it("goes straight from sign-in to the password change while a temporary password is pending", async () => {
    mockApi({
      "POST /auth/student/login": { status: 200, body: tokens },
      "GET /auth/student/me": {
        status: 403,
        body: { detail: "Change it", code: "PASSWORD_CHANGE_REQUIRED" },
      },
    });
    const router = renderApp("/");
    await screen.findByRole("heading", { name: "Hello, Iskolar." });

    await fillAndSubmit();

    expect(await screen.findByRole("heading", { name: "Choose your own password" })).toHaveFocus();
    expect(router.state.location.pathname).toBe("/change-password");
  });

  it("offers a reset when the temporary password has expired", async () => {
    mockApi({
      "POST /auth/student/login": {
        status: 401,
        body: {
          detail: TEMPORARY_EXPIRED,
          request_id: "req-t",
          code: "AUTH_TEMPORARY_PASSWORD_EXPIRED",
        },
      },
    });
    renderApp("/");
    await screen.findByRole("heading", { name: "Hello, Iskolar." });

    await fillAndSubmit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(TEMPORARY_EXPIRED);
    expect(alert).toHaveTextContent("req-t");
    expect(screen.getByRole("link", { name: "Reset your password" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  it("shows the lockout's remaining time and blocks resubmitting until it passes (AC-101.4)", async () => {
    mockApi({
      "POST /auth/student/login": {
        status: 423,
        body: { detail: "Locked", code: "AUTH_ACCOUNT_LOCKED", retry_after_seconds: 600 },
      },
    });
    renderApp("/");
    await screen.findByRole("heading", { name: "Hello, Iskolar." });

    await fillAndSubmit();

    await waitFor(() => expect(screen.getByRole("timer")).toHaveTextContent(/^(10:00|9:59)$/));
    expect(screen.getByRole("button", { name: "Sign in to Portal" })).toBeDisabled();
  });

  it("returns to sign-in with the API's own reason when it ends the session (AC-101.7)", async () => {
    mockApi({
      "POST /auth/student/login": { status: 200, body: tokens },
      "GET /auth/student/me": {
        status: 401,
        body: { detail: "Your session has ended. Sign in again.", code: "AUTH_SESSION_EXPIRED" },
      },
      "POST /auth/student/logout": { status: 204 },
    });
    const router = renderApp("/");
    await screen.findByRole("heading", { name: "Hello, Iskolar." });

    await fillAndSubmit();

    expect(await screen.findByText("Your session has ended. Sign in again.")).toHaveAttribute(
      "role",
      "status",
    );
    // The reason rides in history state, never in the address.
    expect(router.state.location.href).not.toMatch(/ended/);
    expect(screen.getByRole("heading", { name: "Hello, Iskolar." })).toBeInTheDocument();
  });

  it("refreshes an expired access token and carries on without the student noticing", async () => {
    const api = mockApi({
      "POST /auth/student/login": { status: 200, body: tokens },
      "GET /auth/student/me": [
        { status: 401, body: { detail: "Invalid token" } },
        { status: 200, body: me },
      ],
      "POST /auth/student/refresh": {
        status: 200,
        body: { ...tokens, access_token: "access-2", refresh_token: "refresh-2" },
      },
    });
    renderApp("/");
    await screen.findByRole("heading", { name: "Hello, Iskolar." });

    await fillAndSubmit();

    expect(await screen.findByText(`Signed in as ${me.email}`)).toBeInTheDocument();
    expect(api.called("POST /auth/student/refresh")[0].body).toEqual({
      refresh_token: "refresh-1",
    });
    expect(api.called("GET /auth/student/me")[1].authorization).toBe("Bearer access-2");
  });

  it("sends the student back to sign-in when the refresh is refused", async () => {
    mockApi({
      "POST /auth/student/login": { status: 200, body: tokens },
      "GET /auth/student/me": { status: 401, body: { detail: "Invalid token" } },
      "POST /auth/student/refresh": { status: 401, body: { detail: "Refresh token already used" } },
    });
    renderApp("/");
    await screen.findByRole("heading", { name: "Hello, Iskolar." });

    await fillAndSubmit();

    expect(await screen.findByRole("heading", { name: "Hello, Iskolar." })).toBeInTheDocument();
    await waitFor(() => expect(session.isSignedIn()).toBe(false));
  });

  it("signs out on request, ending the session on the API", async () => {
    const api = mockApi({
      "POST /auth/student/login": { status: 200, body: tokens },
      "GET /auth/student/me": { status: 200, body: me },
      "POST /auth/student/logout": { status: 204 },
    });
    renderApp("/");
    await screen.findByRole("heading", { name: "Hello, Iskolar." });
    const user = await fillAndSubmit();
    await screen.findByText(`Signed in as ${me.email}`);

    await user.click(screen.getByRole("button", { name: /^Account menu/ }));
    await user.click(screen.getByRole("button", { name: "Logout" }));

    // Sign out asks first; confirm in the dialog.
    const confirm = await screen.findByRole("alertdialog", { name: "Sign out?" });
    await user.click(within(confirm).getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("heading", { name: "Hello, Iskolar." })).toBeInTheDocument();
    expect(api.called("POST /auth/student/logout")[0].body).toEqual({ refresh_token: "refresh-1" });
  });
});

describe("route guards", () => {
  it("sends a signed-out visitor from the dashboard to sign-in", async () => {
    mockApi({});
    const router = renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Hello, Iskolar." })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("sends a signed-in student away from sign-in to the dashboard", async () => {
    mockApi({ "GET /auth/student/me": { status: 200, body: me } });
    session.signIn({ accessToken: "access-1", refreshToken: "refresh-1" });
    const router = renderApp("/");

    expect(await screen.findByText(`Signed in as ${me.email}`)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");
  });
});
