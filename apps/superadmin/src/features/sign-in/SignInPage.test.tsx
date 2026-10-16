import { mockApi } from "@cbpupsis/account/testing";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { renderApp } from "../../test/renderApp";

const challenge = (enrollmentRequired: boolean) => ({
  mfa_required: true,
  challenge_token: "challenge-1",
  enrollment_required: enrollmentRequired,
  methods: ["totp"],
});
const tokens = {
  access_token: "access-1",
  refresh_token: "refresh-1",
  token_type: "bearer",
  role: "superadmin",
};
const me = {
  id: "6f1c1e8e-0000-4000-8000-000000000004",
  email: "root@pup.edu.ph",
  role: "superadmin",
};
const provisioningUri =
  "otpauth://totp/CBPUPSIS:root%40pup.edu.ph?secret=JBSWY3DPEHPK3PXP&issuer=CBPUPSIS";

async function signInWithPassword() {
  const user = userEvent.setup();
  await screen.findByRole("heading", { name: "Superadmin Portal" });
  await user.type(screen.getByLabelText(/^Email/), "root@pup.edu.ph");
  await user.type(screen.getByLabelText(/^Password/), "correct horse");
  await user.click(screen.getByRole("button", { name: "Sign in to Portal" }));
  return user;
}

async function enterCode(user: ReturnType<typeof userEvent.setup>, code: string, button: RegExp) {
  await user.type(await screen.findByLabelText(/authentication code/i), code);
  await user.click(screen.getByRole("button", { name: button }));
}

afterEach(async () => {
  mockApi({ "POST /auth/superadmin/logout": { status: 204 } });
  await session.signOut();
  vi.unstubAllGlobals();
});

describe("superadmin sign-in (US-104)", () => {
  it("gets only a challenge from the password, and no session until the code (AC-104.1)", async () => {
    const api = mockApi({ "POST /auth/superadmin/login": { status: 200, body: challenge(false) } });
    renderApp("/");

    await signInWithPassword();

    expect(await screen.findByRole("heading", { name: "Two-step verification" })).toHaveFocus();
    expect(session.isSignedIn()).toBe(false);
    expect(api.called("POST /auth/superadmin/login")[0].body).toEqual({
      email: "root@pup.edu.ph",
      password: "correct horse",
    });
  });

  it("signs in with the current code from the authenticator", async () => {
    const api = mockApi({
      "POST /auth/superadmin/login": { status: 200, body: challenge(false) },
      "POST /auth/superadmin/mfa/verify": { status: 200, body: tokens },
      "GET /superadmin/me": { status: 200, body: me },
    });
    renderApp("/");
    const user = await signInWithPassword();

    await enterCode(user, "123456", /verify and sign in/i);

    expect(await screen.findByText(`Signed in as ${me.email}`)).toBeInTheDocument();
    expect(api.called("POST /auth/superadmin/mfa/verify")[0].body).toEqual({
      challenge_token: "challenge-1",
      code: "123456",
    });
  });

  it("walks a first-time superadmin through authenticator setup, then signs in (AC-104.2)", async () => {
    const api = mockApi({
      "POST /auth/superadmin/login": { status: 200, body: challenge(true) },
      "POST /auth/superadmin/mfa/totp/enroll": {
        status: 200,
        body: { provisioning_uri: provisioningUri },
      },
      "POST /auth/superadmin/mfa/totp/confirm": { status: 200, body: tokens },
      "GET /superadmin/me": { status: 200, body: me },
    });
    renderApp("/");
    const user = await signInWithPassword();

    await user.click(await screen.findByRole("button", { name: "Set up authenticator" }));
    expect(await screen.findByLabelText("Setup key")).toHaveValue("JBSWY3DPEHPK3PXP");
    await enterCode(user, "654321", /verify authenticator/i);

    expect(await screen.findByText(`Signed in as ${me.email}`)).toBeInTheDocument();
    expect(api.called("POST /auth/superadmin/mfa/totp/enroll")[0].body).toEqual({
      challenge_token: "challenge-1",
    });
    expect(api.called("POST /auth/superadmin/mfa/totp/confirm")[0].body).toEqual({
      challenge_token: "challenge-1",
      code: "654321",
    });
  });

  it("keeps the superadmin on the code step after a wrong code, with the field cleared", async () => {
    mockApi({
      "POST /auth/superadmin/login": { status: 200, body: challenge(false) },
      "POST /auth/superadmin/mfa/verify": {
        status: 401,
        body: { detail: "Invalid code", code: "AUTH_MFA_INVALID", request_id: "req-7" },
      },
    });
    renderApp("/");
    const user = await signInWithPassword();

    await enterCode(user, "000000", /verify and sign in/i);

    expect(await screen.findByRole("alert")).toHaveTextContent(/not valid/);
    expect(screen.getByLabelText(/authentication code/i)).toHaveValue("");
    expect(screen.getByRole("heading", { name: "Two-step verification" })).toBeInTheDocument();
  });

  it("says a reused code was already used", async () => {
    mockApi({
      "POST /auth/superadmin/login": { status: 200, body: challenge(false) },
      "POST /auth/superadmin/mfa/verify": {
        status: 401,
        body: { detail: "Reused", code: "AUTH_MFA_CODE_REUSED" },
      },
    });
    renderApp("/");
    const user = await signInWithPassword();

    await enterCode(user, "123456", /verify and sign in/i);

    expect(await screen.findByRole("alert")).toHaveTextContent(/already used/);
  });

  it("goes from the second factor straight to the password change while a temporary password is pending", async () => {
    mockApi({
      "POST /auth/superadmin/login": { status: 200, body: challenge(false) },
      "POST /auth/superadmin/mfa/verify": { status: 200, body: tokens },
      "GET /superadmin/me": {
        status: 403,
        body: { detail: "Change it", code: "PASSWORD_CHANGE_REQUIRED" },
      },
    });
    const router = renderApp("/");

    const user = await signInWithPassword();
    await enterCode(user, "123456", /verify and sign in/i);

    expect(await screen.findByRole("heading", { name: "Choose your own password" })).toHaveFocus();
    expect(router.state.location.pathname).toBe("/change-password");
  });

  it("offers a reset when the temporary password has expired", async () => {
    mockApi({
      "POST /auth/superadmin/login": {
        status: 401,
        body: { detail: "x", request_id: "req-t", code: "AUTH_TEMPORARY_PASSWORD_EXPIRED" },
      },
    });
    renderApp("/");

    await signInWithPassword();

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
      "POST /auth/superadmin/login": { status: 200, body: challenge(false) },
      "POST /auth/superadmin/mfa/verify": {
        status: 401,
        body: { detail: "Invalid authentication token" },
      },
    });
    renderApp("/");
    const user = await signInWithPassword();

    await enterCode(user, "123456", /verify and sign in/i);

    expect(await screen.findByRole("alert")).toHaveTextContent(/expired/);
    expect(screen.getByLabelText(/authentication code/i)).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(await screen.findByRole("heading", { name: "Superadmin Portal" })).toBeInTheDocument();
  });

  it("shows the lockout's remaining time on the 5th failure (AC-104.1)", async () => {
    mockApi({
      "POST /auth/superadmin/login": {
        status: 423,
        body: { detail: "Locked", code: "AUTH_ACCOUNT_LOCKED", retry_after_seconds: 300 },
      },
    });
    renderApp("/");

    await signInWithPassword();

    await waitFor(() => expect(screen.getByRole("timer")).toHaveTextContent(/^(5:00|4:59)$/));
    expect(screen.getByRole("button", { name: "Sign in to Portal" })).toBeDisabled();
  });

  it("returns to sign-in, without refreshing, when the session idles out (AC-104.7)", async () => {
    const api = mockApi({
      "POST /auth/superadmin/login": { status: 200, body: challenge(false) },
      "POST /auth/superadmin/mfa/verify": { status: 200, body: tokens },
      "GET /superadmin/me": {
        status: 401,
        body: { detail: "Expired", code: "AUTH_SESSION_EXPIRED" },
      },
    });
    renderApp("/");
    const user = await signInWithPassword();

    await enterCode(user, "123456", /verify and sign in/i);

    expect(await screen.findByText(/inactivity/)).toHaveAttribute("role", "status");
    expect(api.called("POST /auth/superadmin/refresh")).toHaveLength(0);
  });
});

describe("route guards", () => {
  it("sends a signed-out visitor from the dashboard to sign-in", async () => {
    mockApi({});
    const router = renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Superadmin Portal" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("sends a signed-in superadmin away from sign-in to the dashboard", async () => {
    mockApi({ "GET /superadmin/me": { status: 200, body: me } });
    session.signIn({ accessToken: "access-1", refreshToken: "refresh-1" });
    const router = renderApp("/");

    expect(await screen.findByText(`Signed in as ${me.email}`)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");
  });
});
