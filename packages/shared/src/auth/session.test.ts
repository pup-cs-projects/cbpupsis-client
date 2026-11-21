import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/errors";
import { createSession, type SessionEvent, type Tokens } from "./session";

const first: Tokens = { accessToken: "access-1", refreshToken: "refresh-1" };
const second: Tokens = { accessToken: "access-2", refreshToken: "refresh-2" };
const unauthorized = new ApiError(401, undefined);

function setup(refresh = vi.fn<(token?: string) => Promise<Tokens>>().mockResolvedValue(second)) {
  const logout = vi.fn<(token: string) => Promise<void>>().mockResolvedValue(undefined);
  const session = createSession({ refresh, logout });
  const events: SessionEvent[] = [];
  session.subscribe((event) => events.push(event));
  return { session, refresh, logout, events };
}

/** A call that fails with 401 for the expired token and succeeds for the refreshed one. */
function callAcceptingOnly(accepted: string) {
  return vi.fn(async (token: string) => {
    if (token !== accepted) throw unauthorized;
    return token;
  });
}

describe("restore after a page load", () => {
  it("picks the session up from the refresh cookie, without a token in hand", async () => {
    const { session, refresh, events } = setup();

    await expect(session.restore()).resolves.toBe(true);
    expect(refresh).toHaveBeenCalledWith();
    expect(session.isSignedIn()).toBe(true);
    expect(session.lastActivity()).not.toBeNull();
    // Not a fresh sign-in: nothing navigates.
    expect(events).toEqual([]);

    const call = vi.fn(async (token: string) => token);
    await expect(session.authorized(call)).resolves.toBe("access-2");
  });

  it("stays signed out when the API refuses or cannot be reached, and never rejects", async () => {
    const refused = setup(
      vi.fn<(token?: string) => Promise<Tokens>>().mockRejectedValue(unauthorized),
    );
    await expect(refused.session.restore()).resolves.toBe(false);
    expect(refused.session.isSignedIn()).toBe(false);
    expect(refused.events).toEqual([]);

    const offline = setup(
      vi
        .fn<(token?: string) => Promise<Tokens>>()
        .mockRejectedValue(new ApiError(0, "NETWORK_ERROR")),
    );
    await expect(offline.session.restore()).resolves.toBe(false);
  });

  it("asks the API once per page load, however many callers wait on it", async () => {
    const { session, refresh } = setup();

    await Promise.all([session.restore(), session.restore()]);
    await session.restore();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not call the API when already signed in", async () => {
    const { session, refresh } = setup();
    session.signIn(first);

    await expect(session.restore()).resolves.toBe(true);
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("createSession", () => {
  it("refuses authenticated calls before sign-in without calling the API", async () => {
    const { session } = setup();
    const call = vi.fn();

    await expect(session.authorized(call)).rejects.toMatchObject({ code: "NOT_SIGNED_IN" });
    expect(call).not.toHaveBeenCalled();
  });

  it("refreshes once on a 401 and retries the call with the new access token", async () => {
    const { session, refresh } = setup();
    session.signIn(first);

    await expect(session.authorized(callAcceptingOnly("access-2"))).resolves.toBe("access-2");
    expect(refresh).toHaveBeenCalledWith("refresh-1");
  });

  it("shares one refresh between concurrent 401s, because each refresh rotates the token", async () => {
    const { session, refresh } = setup();
    session.signIn(first);
    const call = callAcceptingOnly("access-2");

    const results = await Promise.all([
      session.authorized(call),
      session.authorized(call),
      session.authorized(call),
    ]);

    expect(results).toEqual(["access-2", "access-2", "access-2"]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("ends the session and reports it expired when the refresh is refused", async () => {
    const { session, events } = setup(vi.fn().mockRejectedValue(unauthorized));
    session.signIn(first);

    await expect(session.authorized(callAcceptingOnly("never"))).rejects.toBe(unauthorized);
    expect(session.isSignedIn()).toBe(false);
    expect(events).toEqual(["signed-in", "expired"]);
  });

  it("does not try to revive an idle-expired session with a refresh (AC-104.7)", async () => {
    const { session, refresh, events } = setup();
    session.signIn(first);
    const idle = new ApiError(401, "AUTH_SESSION_EXPIRED");

    await expect(session.authorized(() => Promise.reject(idle))).rejects.toBe(idle);
    expect(refresh).not.toHaveBeenCalled();
    expect(events).toEqual(["signed-in", "expired"]);
  });

  it("passes on the API's own reason when it ends the session", async () => {
    const { session } = setup();
    const reasons: (string | undefined)[] = [];
    session.subscribe((event, reason) => event === "expired" && reasons.push(reason));
    session.signIn(first);
    const idle = new ApiError(401, "AUTH_SESSION_EXPIRED", {
      detail: "Your session has ended. Sign in again.",
    });

    await session.authorized(() => Promise.reject(idle)).catch(() => undefined);

    expect(reasons).toEqual(["Your session has ended. Sign in again."]);
  });

  it("passes on the refresh refusal's wording, and nothing when the refresh never got an answer", async () => {
    const refused = new ApiError(401, undefined, { detail: "Refresh token already used" });
    const offline = new ApiError(0, "NETWORK_ERROR");
    for (const [failure, expected] of [
      [refused, "Refresh token already used"],
      [offline, undefined],
    ] as const) {
      const { session } = setup(vi.fn().mockRejectedValue(failure));
      const reasons: (string | undefined)[] = [];
      session.subscribe((event, reason) => event === "expired" && reasons.push(reason));
      session.signIn(first);

      await session.authorized(callAcceptingOnly("never")).catch(() => undefined);

      expect(reasons).toEqual([expected]);
    }
  });

  it("passes errors other than 401 through without refreshing", async () => {
    const { session, refresh } = setup();
    session.signIn(first);
    const forbidden = new ApiError(403, "AUTH_INSUFFICIENT_ROLE");

    await expect(session.authorized(() => Promise.reject(forbidden))).rejects.toBe(forbidden);
    expect(refresh).not.toHaveBeenCalled();
    expect(session.isSignedIn()).toBe(true);
  });

  it("signals a pending password change and keeps the session for the change itself", async () => {
    const { session } = setup();
    const changeRequired = vi.fn();
    session.onPasswordChangeRequired(changeRequired);
    session.signIn(first);
    const blocked = new ApiError(403, "PASSWORD_CHANGE_REQUIRED");

    await expect(session.authorized(() => Promise.reject(blocked))).rejects.toBe(blocked);
    expect(changeRequired).toHaveBeenCalledTimes(1);
    expect(session.isSignedIn()).toBe(true);
  });

  it("ends a timed-out session on the API and reports it apart from a sign-out", async () => {
    const { session, logout, events } = setup();
    session.signIn(first);

    await session.timeOut();

    expect(logout).toHaveBeenCalledWith("refresh-1");
    expect(session.isSignedIn()).toBe(false);
    expect(session.lastActivity()).toBeNull();
    expect(events).toEqual(["signed-in", "timed-out"]);
  });

  it("forgets the tokens on sign-out even when the API call to end the session fails", async () => {
    const { session, logout, events } = setup();
    logout.mockRejectedValue(new ApiError(0, "NETWORK_ERROR"));
    session.signIn(first);

    await session.signOut();

    expect(logout).toHaveBeenCalledWith("refresh-1");
    expect(session.isSignedIn()).toBe(false);
    expect(events).toEqual(["signed-in", "signed-out"]);
  });
});

describe("lastActivity", () => {
  afterEach(() => vi.useRealTimers());

  it("starts at sign-in and is cleared on sign-out", async () => {
    vi.useFakeTimers({ now: 1_000 });
    const { session } = setup();
    expect(session.lastActivity()).toBeNull();

    session.signIn(first);
    expect(session.lastActivity()).toBe(1_000);

    await session.signOut();
    expect(session.lastActivity()).toBeNull();
  });

  it("moves to the start of each call the API answered, even with an error", async () => {
    vi.useFakeTimers({ now: 1_000 });
    const { session } = setup();
    session.signIn(first);

    vi.setSystemTime(5_000);
    await session.authorized(async () => {
      vi.setSystemTime(9_000);
      return "ok";
    });
    expect(session.lastActivity()).toBe(5_000);

    vi.setSystemTime(20_000);
    await session
      .authorized(() => Promise.reject(new ApiError(404, "RESOURCE_NOT_FOUND")))
      .catch(() => undefined);
    expect(session.lastActivity()).toBe(20_000);
  });

  it("does not move for a call that never reached the API", async () => {
    vi.useFakeTimers({ now: 1_000 });
    const { session } = setup();
    session.signIn(first);

    vi.setSystemTime(5_000);
    await session
      .authorized(() => Promise.reject(new ApiError(0, "NETWORK_ERROR")))
      .catch(() => undefined);

    expect(session.lastActivity()).toBe(1_000);
  });
});
