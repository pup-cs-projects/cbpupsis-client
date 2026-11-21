import { mockApi } from "@cbpupsis/account/testing";
import { NOTICES } from "@cbpupsis/shared/auth";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { renderApp } from "../../test/renderApp";

// The API's own sentences (cbpupsis_shared/domains/auth), shown unchanged.
const ID_FORMAT = "Invalid employee ID format. Expected format: YYYY-NNNNN-XX-N";
const SESSION_ENDED = "Your session has ended. Sign in again.";
const TEMPORARY_EXPIRED =
  "Your temporary password has expired. Ask the system administrator to issue a new one.";

const challenge = (enrollmentRequired: boolean) => ({
  mfa_required: true,
  challenge_token: "test-challenge",
  enrollment_required: enrollmentRequired,
  // The API lists the factors already enrolled, so a first sign-in has none.
  methods: enrollmentRequired ? [] : ["totp"],
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
  it("enters the portal without MFA when the development API returns tokens", async () => {
    const api = mockApi({
      "POST /auth/faculty/login": { status: 200, body: tokens },
      "GET /auth/faculty/me": { status: 200, body: me },
    });
    const router = renderApp("/");
    await submitPassword();
    await waitFor(() => expect(session.isSignedIn()).toBe(true));
    await waitFor(() => expect(api.called("GET /auth/faculty/me").length).toBeGreaterThan(0));
    await waitFor(() => expect(router.state.location.pathname).toBe("/dashboard"));
    expect(screen.queryByRole("heading", { name: "Two-step verification" })).toBeNull();
    expect(api.calls.some((call) => call.route.includes("/mfa/"))).toBe(false);
  });

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

  it("shows the busy button and prevents duplicate submission", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    renderApp("/");

    await submitPassword();

    expect(await screen.findByRole("status", { name: /Please wait/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
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
        body: { detail: ID_FORMAT, code: "AUTH_ID_FORMAT_INVALID" },
      },
    });
    renderApp("/");

    await submitPassword();

    expect(await screen.findByLabelText(/Faculty ID/)).toHaveAccessibleDescription(ID_FORMAT);
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
        body: {
          detail: "That security code has already been used; enter the current code",
          code: "AUTH_MFA_CODE_REUSED",
          request_id: "request-123",
        },
      },
    });
    renderApp("/");
    await submitPassword();

    await enterCode();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "That security code has already been used; enter the current code",
    );
    expect(alert).toHaveTextContent("request-123");
    expect(session.isSignedIn()).toBe(false);
  });

  it("displays lockout timing and blocks the code until the waiting period ends (AC-102.5)", async () => {
    mockApi({
      "POST /auth/faculty/login": { status: 200, body: challenge(false) },
      "POST /auth/faculty/mfa/verify": {
        status: 423,
        body: {
          detail: "Account temporarily locked after repeated sign-in failures",
          code: "AUTH_ACCOUNT_LOCKED",
          retry_after_seconds: 2,
        },
      },
    });
    renderApp("/");
    await submitPassword();

    await enterCode();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Account temporarily locked after repeated sign-in failures",
    );
    expect(screen.getByLabelText(/Authentication code/)).toBeDisabled();
    expect(
      screen.getByRole("timer", { name: "Time before you can try again" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/Authentication code/)).toBeEnabled(), {
      timeout: 4000,
    });
  });

  it("blocks an expired challenge and offers a fresh sign-in", async () => {
    mockApi({
      "POST /auth/faculty/login": { status: 200, body: challenge(false) },
      "POST /auth/faculty/mfa/verify": {
        status: 401,
        body: { detail: "Invalid or expired token" },
      },
    });
    renderApp("/");
    await submitPassword();

    await enterCode();

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid or expired token");
    expect(screen.getByLabelText(/Authentication code/)).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(await screen.findByRole("heading", { name: "Faculty Portal" })).toBeInTheDocument();
  });

  it("takes a first sign-in, with no factor enrolled yet, to authenticator setup", async () => {
    mockApi({ "POST /auth/faculty/login": { status: 200, body: challenge(true) } });
    renderApp("/");

    await submitPassword();

    expect(await screen.findByRole("heading", { name: "Secure your account" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Set up authenticator" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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

  it.each([false, true])(
    "requires temporary-password change (development skip: %s)",
    async (skip) => {
      mockApi({
        "POST /auth/faculty/login": { status: 200, body: skip ? tokens : challenge(false) },
        "POST /auth/faculty/mfa/verify": { status: 200, body: tokens },
        "GET /auth/faculty/me": {
          status: 403,
          body: { detail: "Change it", code: "PASSWORD_CHANGE_REQUIRED" },
        },
      });
      const router = renderApp("/");

      await submitPassword();
      if (!skip) await enterCode();

      expect(
        await screen.findByRole("heading", { name: "Choose your own password" }),
      ).toHaveFocus();
      expect(router.state.location.pathname).toBe("/change-password");
    },
  );

  it("returns to sign-in with the API's reason when the session ends right after the code", async () => {
    mockApi({
      "POST /auth/faculty/login": { status: 200, body: challenge(false) },
      "POST /auth/faculty/mfa/verify": { status: 200, body: tokens },
      "GET /auth/faculty/me": {
        status: 401,
        body: { detail: SESSION_ENDED, code: "AUTH_SESSION_EXPIRED" },
      },
    });
    renderApp("/");

    await submitPassword();
    await enterCode();

    expect(await screen.findByText(SESSION_ENDED)).toHaveAttribute("role", "status");
    expect(screen.getByRole("heading", { name: "Faculty Portal" })).toBeInTheDocument();
  });

  it("offers a reset when the temporary password has expired", async () => {
    mockApi({
      "POST /auth/faculty/login": {
        status: 401,
        body: {
          detail: TEMPORARY_EXPIRED,
          request_id: "req-t",
          code: "AUTH_TEMPORARY_PASSWORD_EXPIRED",
        },
      },
    });
    renderApp("/");

    await submitPassword();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(TEMPORARY_EXPIRED);
    expect(alert).toHaveTextContent("req-t");
    expect(screen.getByRole("link", { name: "Reset your password" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  it("offers retry when setup is unavailable", async () => {
    mockApi({
      "POST /auth/faculty/login": { status: 200, body: challenge(true) },
      "POST /auth/faculty/mfa/totp/enroll": {
        status: 503,
        body: { detail: "Authenticator setup is unavailable right now." },
      },
    });
    renderApp("/");
    await submitPassword();

    fireEvent.click(await screen.findByRole("button", { name: "Set up authenticator" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Authenticator setup is unavailable right now.",
    );
    expect(screen.getByRole("button", { name: "Retry authenticator setup" })).toBeEnabled();
  });
});

describe("session", () => {
  it("returns to sign-in with the client's own notice when the API ends the session without words", async () => {
    mockApi({ "GET /auth/faculty/me": { status: 401, body: { code: "AUTH_SESSION_EXPIRED" } } });
    session.signIn({ accessToken: "access-1", refreshToken: "refresh-1" });
    renderApp("/dashboard");

    expect(await screen.findByText(NOTICES.sessionEnded)).toHaveAttribute("role", "status");
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
    // Sign out asks first; confirm in the dialog.
    const confirm = await screen.findByRole("alertdialog", { name: "Sign out?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("heading", { name: "Faculty Portal" })).toBeInTheDocument();
    expect(api.called("POST /auth/faculty/logout")[0].body).toEqual({ refresh_token: "refresh-1" });
  });
});
