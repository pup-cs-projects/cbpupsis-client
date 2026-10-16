import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { mockApi } from "../../test/mockApi";
import { renderApp } from "../../test/renderApp";

const challenge = (enrollmentRequired: boolean) => ({
  mfa_required: true,
  challenge_token: "test-challenge",
  enrollment_required: enrollmentRequired,
  methods: ["totp"],
});
const tokens = {
  access_token: "access-1",
  refresh_token: "refresh-1",
  token_type: "bearer",
  role: "faculty",
  expires_in: 900,
};
const me = {
  id: "6f1c1e8e-0000-4000-8000-000000000002",
  email: "faculty@pup.edu.ph",
  employee_id: "2021-00456-MN-0",
  role: "faculty",
};
const provisioningUri =
  "otpauth://totp/CBPUPSIS:faculty%40pup.edu.ph?secret=TESTSECRET234&issuer=CBPUPSIS";

async function submitPassword() {
  await screen.findByRole("heading", { name: "Faculty Portal" });
  fireEvent.change(screen.getByLabelText(/Faculty ID/), { target: { value: "2021-00456-MN-0" } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in to Portal" }));
}

async function enterCode(value = "123456", button = "Verify and sign in") {
  fireEvent.change(await screen.findByLabelText(/Authentication code|Recovery code/), {
    target: { value },
  });
  fireEvent.click(screen.getByRole("button", { name: button }));
}

afterEach(async () => {
  mockApi({ "POST /auth/faculty/logout": { status: 204 } });
  await session.signOut();
  vi.unstubAllGlobals();
});

describe("faculty sign-in (US-102)", () => {
  it("has labelled keyboard reachable fields and a password visibility toggle", async () => {
    mockApi({});
    renderApp("/");
    await screen.findByRole("heading", { name: "Faculty Portal" });
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("link", { name: "Skip to sign in" })).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText(/Faculty ID/)).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText(/^Password/)).toHaveAttribute("type", "text");
  });

  it("sends only the employee id and password, in the API's field names", async () => {
    const api = mockApi({ "POST /auth/faculty/login": { status: 200, body: challenge(false) } });
    renderApp("/");

    await submitPassword();

    await screen.findByRole("heading", { name: "Two-step verification" });
    expect(api.called("POST /auth/faculty/login")[0].body).toEqual({
      employee_id: "2021-00456-MN-0",
      password: "test-password",
    });
  });

  it("shows skeleton loading and prevents duplicate submission", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    renderApp("/");

    await submitPassword();

    expect(await screen.findByRole("status", { name: /Please wait/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in to Portal" })).toBeDisabled();
  });

  it("does not create a session after the password step (AC-102.1)", async () => {
    mockApi({ "POST /auth/faculty/login": { status: 200, body: challenge(false) } });
    renderApp("/");

    await submitPassword();

    expect(await screen.findByRole("heading", { name: "Two-step verification" })).toHaveFocus();
    expect(session.isSignedIn()).toBe(false);
  });

  it("shows a malformed faculty id as an error on that field", async () => {
    mockApi({
      "POST /auth/faculty/login": {
        status: 422,
        body: { detail: "Bad format", code: "AUTH_ID_FORMAT_INVALID" },
      },
    });
    renderApp("/");

    await submitPassword();

    expect(await screen.findByText(/YYYY-NNNNN-XX-N/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Faculty ID/)).toHaveAttribute("aria-invalid", "true");
  });

  it("opens the faculty dashboard after the current code, with tokens only in memory (AC-102.3)", async () => {
    const api = mockApi({
      "POST /auth/faculty/login": { status: 200, body: challenge(false) },
      "POST /auth/faculty/mfa/verify": { status: 200, body: tokens },
      "GET /auth/faculty/me": { status: 200, body: me },
    });
    const router = renderApp("/");
    await submitPassword();

    await enterCode();

    expect(await screen.findByText(`Signed in as ${me.email}`)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");
    expect(api.called("POST /auth/faculty/mfa/verify")[0].body).toEqual({
      challenge_token: "test-challenge",
      code: "123456",
    });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("signs in with a recovery code in place of the app code", async () => {
    const api = mockApi({
      "POST /auth/faculty/login": { status: 200, body: challenge(false) },
      "POST /auth/faculty/mfa/verify": { status: 200, body: tokens },
      "GET /auth/faculty/me": { status: 200, body: me },
    });
    renderApp("/");
    await submitPassword();
    fireEvent.click(await screen.findByRole("button", { name: "Use a recovery code" }));

    await enterCode("ABCD-EFGH");

    await screen.findByText(`Signed in as ${me.email}`);
    expect(api.called("POST /auth/faculty/mfa/verify")[0].body).toEqual({
      challenge_token: "test-challenge",
      recovery_code: "ABCD-EFGH",
    });
  });

  it("says a reused code was already used, with the reference, and starts no session (AC-102.4)", async () => {
    mockApi({
      "POST /auth/faculty/login": { status: 200, body: challenge(false) },
      "POST /auth/faculty/mfa/verify": {
        status: 401,
        body: { detail: "Reused", code: "AUTH_MFA_CODE_REUSED", request_id: "request-123" },
      },
    });
    renderApp("/");
    await submitPassword();

    await enterCode();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("already used");
    expect(alert).toHaveTextContent("request-123");
    expect(session.isSignedIn()).toBe(false);
  });

  it("displays lockout timing and blocks the code until the waiting period ends (AC-102.5)", async () => {
    mockApi({
      "POST /auth/faculty/login": { status: 200, body: challenge(false) },
      "POST /auth/faculty/mfa/verify": {
        status: 423,
        body: { detail: "Locked", code: "AUTH_ACCOUNT_LOCKED", retry_after_seconds: 2 },
      },
    });
    renderApp("/");
    await submitPassword();

    await enterCode();

    await screen.findByRole("alert");
    expect(screen.getByLabelText(/Authentication code/)).toBeDisabled();
    expect(screen.getByRole("timer", { name: "Time before retry" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/Authentication code/)).toBeEnabled(), {
      timeout: 4000,
    });
  });

  it("blocks an expired challenge and offers a fresh sign-in", async () => {
    mockApi({
      "POST /auth/faculty/login": { status: 200, body: challenge(false) },
      "POST /auth/faculty/mfa/verify": { status: 401, body: { detail: "Invalid token" } },
    });
    renderApp("/");
    await submitPassword();

    await enterCode();

    expect(await screen.findByRole("alert")).toHaveTextContent(/expired/);
    expect(screen.getByLabelText(/Authentication code/)).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(await screen.findByRole("heading", { name: "Faculty Portal" })).toBeInTheDocument();
  });

  it("sets up the authenticator, shows recovery codes once, then opens the dashboard (AC-102.2)", async () => {
    const api = mockApi({
      "POST /auth/faculty/login": { status: 200, body: challenge(true) },
      "POST /auth/faculty/mfa/totp/enroll": {
        status: 200,
        body: { secret: "TESTSECRET234", provisioning_uri: provisioningUri },
      },
      "POST /auth/faculty/mfa/totp/confirm": {
        status: 200,
        body: { ...tokens, recovery_codes: ["TEST-1111", "TEST-2222"] },
      },
      "GET /auth/faculty/me": { status: 200, body: me },
    });
    renderApp("/");
    await submitPassword();
    await screen.findByRole("heading", { name: "Secure your account" });
    expect(screen.queryByLabelText(/Authentication code/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Set up authenticator" }));
    expect(await screen.findByLabelText("Setup key")).toHaveValue("TESTSECRET234");
    await enterCode("654321", "Verify authenticator");

    expect(await screen.findByRole("list", { name: "Recovery codes" })).toHaveTextContent(
      "TEST-1111",
    );
    expect(screen.queryByLabelText(/Authentication code/)).not.toBeInTheDocument();
    expect(api.called("POST /auth/faculty/mfa/verify")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "I have saved my recovery codes" }));
    expect(await screen.findByText(`Signed in as ${me.email}`)).toBeInTheDocument();
    expect(screen.queryByText("TEST-1111")).not.toBeInTheDocument();
  });

  it("offers retry when setup is unavailable", async () => {
    mockApi({
      "POST /auth/faculty/login": { status: 200, body: challenge(true) },
      "POST /auth/faculty/mfa/totp/enroll": { status: 503, body: { detail: "Unavailable" } },
    });
    renderApp("/");
    await submitPassword();

    fireEvent.click(await screen.findByRole("button", { name: "Set up authenticator" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("try again");
    expect(screen.getByRole("button", { name: "Retry authenticator setup" })).toBeEnabled();
  });
});

describe("session", () => {
  it("returns to sign-in with an inactivity notice when the session idles out", async () => {
    mockApi({ "GET /auth/faculty/me": { status: 401, body: { code: "AUTH_SESSION_EXPIRED" } } });
    session.signIn({ accessToken: "access-1", refreshToken: "refresh-1" });
    renderApp("/dashboard");

    expect(await screen.findByText(/inactivity/)).toHaveAttribute("role", "status");
    expect(session.isSignedIn()).toBe(false);
  });

  it("sends a signed-out visitor from the dashboard to sign-in", async () => {
    mockApi({});
    const router = renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Faculty Portal" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("signs out, ending the session on the API", async () => {
    const api = mockApi({
      "GET /auth/faculty/me": { status: 200, body: me },
      "POST /auth/faculty/logout": { status: 204 },
    });
    session.signIn({ accessToken: "access-1", refreshToken: "refresh-1" });
    renderApp("/dashboard");
    await screen.findByText(`Signed in as ${me.email}`);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("heading", { name: "Faculty Portal" })).toBeInTheDocument();
    expect(api.called("POST /auth/faculty/logout")[0].body).toEqual({ refresh_token: "refresh-1" });
  });
});
