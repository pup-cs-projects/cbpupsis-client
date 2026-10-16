import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/errors";
import { createSession, type SessionEvent, type Tokens } from "./session";

const first: Tokens = { accessToken: "access-1", refreshToken: "refresh-1" };
const second: Tokens = { accessToken: "access-2", refreshToken: "refresh-2" };
const unauthorized = new ApiError(401, undefined);

function setup(refresh = vi.fn<(token: string) => Promise<Tokens>>().mockResolvedValue(second)) {
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

  it("passes errors other than 401 through without refreshing", async () => {
    const { session, refresh } = setup();
    session.signIn(first);
    const forbidden = new ApiError(403, "AUTH_INSUFFICIENT_ROLE");

    await expect(session.authorized(() => Promise.reject(forbidden))).rejects.toBe(forbidden);
    expect(refresh).not.toHaveBeenCalled();
    expect(session.isSignedIn()).toBe(true);
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
