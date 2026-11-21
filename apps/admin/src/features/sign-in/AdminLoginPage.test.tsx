import { mockApi } from "@cbpupsis/account/testing";
import { ApiError } from "@cbpupsis/shared/api";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { createCredential, signChallenge } from "../../lib/webauthn";
import { renderApp } from "../../test/renderApp";

// The browser's security-key prompt cannot run in jsdom; everything else here is real.
vi.mock("../../lib/webauthn", () => ({ createCredential: vi.fn(), signChallenge: vi.fn() }));

const challenge = (enrollmentRequired: boolean, credentialId: string | null = "cred-1") => ({
  mfa_required: true,
  challenge_token: "test-challenge",
  enrollment_required: enrollmentRequired,
  methods: ["totp", "webauthn"],
  webauthn_challenge: "webauthn-challenge",
  webauthn_rp_id: "admin.cbpupsis",
  webauthn_credential_id: credentialId,
});
const tokens = {
  access_token: "access-1",
  refresh_token: "refresh-1",
  token_type: "bearer",
  role: "admin",
  position: "registrar",
};
const me = {
  role: "admin",
  id: "6f1c1e8e-0000-4000-8000-000000000003",
  email: "registrar@pup.edu.ph",
  position: "registrar",
  department_id: null,
  college_id: null,
};
const provisioningUri =
  "otpauth://totp/CBPUPSIS:registrar%40pup.edu.ph?secret=ADMINSECRET234&issuer=CBPUPSIS";

async function submitPassword() {
  await screen.findByRole("heading", { name: "Admin Portal" });
  fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "registrar@pup.edu.ph" } });
  fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "test-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in to Portal" }));
}

async function enterCode(button = "Verify and sign in") {
  fireEvent.change(await screen.findByLabelText(/Authentication code/), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: button }));
}

beforeEach(() => vi.clearAllMocks());

afterEach(async () => {
  mockApi({ "POST /auth/admin/logout": { status: 204 } });
  await session.signOut();
  vi.unstubAllGlobals();
});

describe("admin sign-in (US-103)", () => {
  it("validates required fields before contacting the API", async () => {
    const api = mockApi({});
    renderApp("/");
    await screen.findByRole("heading", { name: "Admin Portal" });

    fireEvent.click(screen.getByRole("button", { name: "Sign in to Portal" }));

    expect(screen.getByText("Enter your email.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
  });

  it("gets only a challenge from the password, sent as email and password (AC-103.1)", async () => {
    const api = mockApi({ "POST /auth/admin/login": { status: 200, body: challenge(false) } });
    renderApp("/");

    await submitPassword();

    expect(await screen.findByRole("heading", { name: "Two-step verification" })).toHaveFocus();
    expect(session.isSignedIn()).toBe(false);
    expect(api.called("POST /auth/admin/login")[0].body).toEqual({
      email: "registrar@pup.edu.ph",
      password: "test-password",
    });
  });

  it("signs in with an authenticator code and shows the admin's position", async () => {
    const api = mockApi({
      "POST /auth/admin/login": { status: 200, body: challenge(false) },
      "POST /auth/admin/mfa/verify": { status: 200, body: tokens },
      "GET /admin/me": { status: 200, body: me },
    });
    const router = renderApp("/");
    await submitPassword();

    await enterCode();

    expect(
      await screen.findByText(/Signed in as registrar@pup.edu.ph \(Registrar\)/),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");
    expect(api.called("POST /auth/admin/mfa/verify")[0].body).toEqual({
      challenge_token: "test-challenge",
      code: "123456",
    });
  });

  it("signs in with the enrolled security key", async () => {
    vi.mocked(signChallenge).mockResolvedValue({ id: "cred-1", response: {} });
    const api = mockApi({
      "POST /auth/admin/login": { status: 200, body: challenge(false) },
      "POST /auth/admin/mfa/verify": { status: 200, body: tokens },
      "GET /admin/me": { status: 200, body: me },
    });
    renderApp("/");
    await submitPassword();

    fireEvent.click(await screen.findByRole("button", { name: "Use a security key" }));

    await screen.findByText(/Signed in as registrar@pup.edu.ph/);
    expect(signChallenge).toHaveBeenCalledWith({
      challenge: "webauthn-challenge",
      rpId: "admin.cbpupsis",
      credentialId: "cred-1",
    });
    expect(api.called("POST /auth/admin/mfa/verify")[0].body).toEqual({
      challenge_token: "test-challenge",
      assertion: { id: "cred-1", response: {} },
    });
  });

  it("offers no security key to an admin who has not enrolled one", async () => {
    mockApi({ "POST /auth/admin/login": { status: 200, body: challenge(false, null) } });
    renderApp("/");

    await submitPassword();

    await screen.findByRole("heading", { name: "Two-step verification" });
    expect(screen.queryByRole("button", { name: "Use a security key" })).not.toBeInTheDocument();
  });

  it("says when the security key prompt was cancelled, and starts no session", async () => {
    vi.mocked(signChallenge).mockRejectedValue(new ApiError(0, "WEBAUTHN_CANCELLED"));
    mockApi({ "POST /auth/admin/login": { status: 200, body: challenge(false) } });
    renderApp("/");
    await submitPassword();

    fireEvent.click(await screen.findByRole("button", { name: "Use a security key" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/cancelled/);
    expect(session.isSignedIn()).toBe(false);
  });

  it("enrolls an authenticator app and signs in on the confirmed code (AC-103.2)", async () => {
    const api = mockApi({
      "POST /auth/admin/login": { status: 200, body: challenge(true, null) },
      "POST /auth/admin/mfa/totp/enroll": {
        status: 200,
        body: { secret: "ADMINSECRET234", provisioning_uri: provisioningUri },
      },
      "POST /auth/admin/mfa/totp/confirm": { status: 200, body: tokens },
      "GET /admin/me": { status: 200, body: me },
    });
    renderApp("/");
    await submitPassword();
    await screen.findByRole("heading", { name: "Secure your account" });

    fireEvent.click(screen.getByRole("button", { name: "Set up authenticator" }));
    expect(await screen.findByLabelText("Setup key")).toHaveValue("ADMINSECRET234");
    await enterCode("Verify authenticator");

    await screen.findByText(/Signed in as registrar@pup.edu.ph/);
    expect(api.called("POST /auth/admin/mfa/totp/confirm")[0].body).toEqual({
      challenge_token: "test-challenge",
      code: "123456",
    });
  });

  it("enrolls a security key and signs in (AC-103.2)", async () => {
    vi.mocked(createCredential).mockResolvedValue({ id: "new-cred", response: {} });
    const api = mockApi({
      "POST /auth/admin/login": { status: 200, body: challenge(true, null) },
      "POST /auth/admin/mfa/webauthn/enroll": {
        status: 200,
        body: { public_key: { challenge: "reg-challenge", rp: { id: "admin.cbpupsis" } } },
      },
      "POST /auth/admin/mfa/webauthn/confirm": { status: 200, body: tokens },
      "GET /admin/me": { status: 200, body: me },
    });
    renderApp("/");
    await submitPassword();

    fireEvent.click(await screen.findByRole("button", { name: "Register a security key" }));

    await screen.findByText(/Signed in as registrar@pup.edu.ph/);
    expect(createCredential).toHaveBeenCalledWith({
      challenge: "reg-challenge",
      rp: { id: "admin.cbpupsis" },
    });
    expect(api.called("POST /auth/admin/mfa/webauthn/confirm")[0].body).toEqual({
      challenge_token: "test-challenge",
      credential: { id: "new-cred", response: {} },
    });
  });

  it("locks the code step on the 5th failure and starts no session (AC-103.5)", async () => {
    mockApi({
      "POST /auth/admin/login": { status: 200, body: challenge(false) },
      "POST /auth/admin/mfa/verify": {
        status: 423,
        body: { detail: "Locked", code: "AUTH_ACCOUNT_LOCKED", retry_after_seconds: 900 },
      },
    });
    renderApp("/");
    await submitPassword();

    await enterCode();

    await waitFor(() =>
      expect(screen.getByRole("timer", { name: "Time before retry" })).toHaveTextContent(
        /^(15:00|14:59)$/,
      ),
    );
    expect(screen.getByLabelText(/Authentication code/)).toBeDisabled();
    expect(session.isSignedIn()).toBe(false);
  });

  it("says a replayed code was already used (AC-103.6)", async () => {
    mockApi({
      "POST /auth/admin/login": { status: 200, body: challenge(false) },
      "POST /auth/admin/mfa/verify": {
        status: 401,
        body: { detail: "Reused", code: "AUTH_MFA_CODE_REUSED", request_id: "req-9" },
      },
    });
    renderApp("/");
    await submitPassword();

    await enterCode();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("already used");
    expect(alert).toHaveTextContent("req-9");
  });

  it("goes from the second factor straight to the password change while a temporary password is pending", async () => {
    mockApi({
      "POST /auth/admin/login": { status: 200, body: challenge(false) },
      "POST /auth/admin/mfa/verify": { status: 200, body: tokens },
      "GET /admin/me": {
        status: 403,
        body: { detail: "Change it", code: "PASSWORD_CHANGE_REQUIRED" },
      },
    });
    const router = renderApp("/");

    await submitPassword();
    await enterCode();

    expect(await screen.findByRole("heading", { name: "Choose your own password" })).toHaveFocus();
    expect(router.state.location.pathname).toBe("/change-password");
  });

  it("returns to sign-in with the inactivity notice when the session ends right after the code", async () => {
    mockApi({
      "POST /auth/admin/login": { status: 200, body: challenge(false) },
      "POST /auth/admin/mfa/verify": { status: 200, body: tokens },
      "GET /admin/me": { status: 401, body: { detail: "Expired", code: "AUTH_SESSION_EXPIRED" } },
    });
    renderApp("/");

    await submitPassword();
    await enterCode();

    expect(await screen.findByText(/inactivity/)).toHaveAttribute("role", "status");
    expect(screen.getByRole("heading", { name: "Admin Portal" })).toBeInTheDocument();
  });

  it("offers a reset when the temporary password has expired", async () => {
    mockApi({
      "POST /auth/admin/login": {
        status: 401,
        body: { detail: "x", request_id: "req-t", code: "AUTH_TEMPORARY_PASSWORD_EXPIRED" },
      },
    });
    renderApp("/");

    await submitPassword();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your temporary password has expired.");
    expect(alert).toHaveTextContent("Reference: req-t");
    expect(screen.getByRole("link", { name: "Reset your password" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });

  it("blocks an expired challenge and offers a fresh sign-in", async () => {
    mockApi({
      "POST /auth/admin/login": { status: 200, body: challenge(false) },
      "POST /auth/admin/mfa/verify": { status: 401, body: { detail: "Invalid token" } },
    });
    renderApp("/");
    await submitPassword();

    await enterCode();

    expect(await screen.findByRole("alert")).toHaveTextContent(/expired/);
    expect(screen.getByRole("button", { name: "Use a security key" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(await screen.findByRole("heading", { name: "Admin Portal" })).toBeInTheDocument();
  });
});

describe("session", () => {
  it("sends a signed-out visitor from the dashboard to sign-in", async () => {
    mockApi({});
    const router = renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Admin Portal" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("returns to sign-in with an inactivity notice when the session idles out", async () => {
    mockApi({ "GET /admin/me": { status: 401, body: { code: "AUTH_SESSION_EXPIRED" } } });
    session.signIn({ accessToken: "access-1", refreshToken: "refresh-1" });
    renderApp("/dashboard");

    expect(await screen.findByText(/inactivity/)).toHaveAttribute("role", "status");
  });

  it("signs out from the dashboard, ending the session on the API", async () => {
    const api = mockApi({
      "GET /admin/me": { status: 200, body: me },
      "POST /auth/admin/logout": { status: 204 },
    });
    session.signIn({ accessToken: "access-1", refreshToken: "refresh-1" });
    renderApp("/dashboard");
    await screen.findByText(/Signed in as registrar@pup.edu.ph/);

    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("heading", { name: "Admin Portal" })).toBeInTheDocument();
    expect(api.called("POST /auth/admin/logout")[0].body).toEqual({ refresh_token: "refresh-1" });
  });
});
