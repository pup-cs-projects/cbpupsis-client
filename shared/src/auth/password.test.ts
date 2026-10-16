import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import {
  CHANGE_PASSWORD_POLICY,
  changePassword,
  checkPassword,
  createPasswordApi,
  meetsPolicy,
  resetLinkProblem,
  type PasswordPolicy,
} from "./password";
import { createSession } from "./session";

const api = createPasswordApi(createApiClient("http://api.test/api/v1"));

function respond(...replies: { body?: unknown; status?: number }[]) {
  const fetchMock = vi.fn();
  for (const { body, status = 200 } of replies) {
    fetchMock.mockResolvedValueOnce(
      new Response(body === undefined ? null : JSON.stringify(body), { status }),
    );
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sent(fetchMock: ReturnType<typeof respond>, index = 0) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, body: JSON.parse(String(init.body)) as unknown };
}

afterEach(() => vi.unstubAllGlobals());

const RESET_POLICY: PasswordPolicy = {
  minimumLength: 8,
  rules: ["uppercase", "lowercase", "digit", "symbol"],
};

describe("checkPassword", () => {
  it("ticks each rule separately as the password grows", () => {
    const unmet = (password: string) =>
      checkPassword(RESET_POLICY, password)
        .filter((check) => !check.met)
        .map((check) => check.rule);

    expect(unmet("")).toEqual(["length", "uppercase", "lowercase", "digit", "symbol"]);
    expect(unmet("abc")).toEqual(["length", "uppercase", "digit", "symbol"]);
    expect(unmet("Abc1!")).toEqual(["length"]);
    expect(unmet("Abcdef1!")).toEqual([]);
  });

  it("counts the minimum length in characters, the way the API does, not UTF-16 units", () => {
    const [length] = checkPassword({ minimumLength: 8, rules: [] }, "Ab1!😀😀😀");

    expect(length.met).toBe(false);
  });

  it("treats letters outside A to Z the way the API does", () => {
    const checks = checkPassword(RESET_POLICY, "Ñandú1é!");

    expect(meetsPolicy(checks)).toBe(true);
  });

  it("does not count a space as a symbol", () => {
    const symbol = checkPassword(RESET_POLICY, "Abc def1").find((check) => check.rule === "symbol");

    expect(symbol?.met).toBe(false);
  });

  it("requires a changed password to differ from the temporary one", () => {
    const temporary = "Temp-Pass-2026!x";
    const differs = (password: string) =>
      checkPassword(CHANGE_PASSWORD_POLICY, password, { current: temporary }).find(
        (check) => check.rule === "different",
      )?.met;

    expect(differs(temporary)).toBe(false);
    expect(differs("my own passphrase")).toBe(true);
    expect(differs("")).toBe(false);
  });

  it("labels the length rule with the policy's minimum", () => {
    expect(checkPassword(CHANGE_PASSWORD_POLICY, "")[0].label).toBe("At least 12 characters");
  });
});

describe("password reset", () => {
  it("requests a link by email only", async () => {
    const fetchMock = respond({ status: 202, body: { message: "If that address..." } });

    await api.requestReset("ana@pup.edu.ph");

    expect(sent(fetchMock)).toEqual({
      url: "http://api.test/api/v1/auth/forgot-password",
      body: { email: "ana@pup.edu.ph" },
    });
  });

  it("checks a link without spending it and reads the rules the API names", async () => {
    const fetchMock = respond({
      body: {
        valid: true,
        minimumLength: 8,
        requiredRules: ["uppercase", "lowercase", "digit", "symbol"],
      },
    });

    await expect(api.checkResetLink("t")).resolves.toEqual(RESET_POLICY);
    expect(sent(fetchMock).body).toEqual({ token: "t", verify_only: true });
  });

  it("leaves out a rule this client cannot check rather than guessing at it", async () => {
    respond({ body: { valid: true, minimumLength: 10, requiredRules: ["digit", "emoji"] } });

    await expect(api.checkResetLink("t")).resolves.toEqual({
      minimumLength: 10,
      rules: ["digit"],
    });
  });

  it("names an unknown link, which the API refuses with a bare 401", async () => {
    respond({ status: 401, body: { detail: "Invalid or expired token", request_id: "r1" } });

    const error = await api.checkResetLink("nope").catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: "RESET_LINK_INVALID", requestId: "r1" });
    expect(resetLinkProblem(error)).toBe("invalid");
  });

  it.each([
    ["AUTH_RESET_TOKEN_EXPIRED", "expired"],
    ["AUTH_RESET_TOKEN_USED", "used"],
  ] as const)("reports %s as a link that is %s", async (code, problem) => {
    respond({ status: 410, body: { detail: "x", code } });

    const error = await api.checkResetLink("t").catch((caught: unknown) => caught);

    expect(resetLinkProblem(error)).toBe(problem);
  });

  it("sets the new password and reports how many sessions ended (AC-105.6)", async () => {
    const fetchMock = respond({ body: { sessionsRevoked: 2 } });

    await expect(api.resetPassword("t", "Abcdef1!")).resolves.toEqual({ sessionsRevoked: 2 });
    expect(sent(fetchMock).body).toEqual({ token: "t", new_password: "Abcdef1!" });
  });

  it("passes a weak password's refusal through with its code (AC-105.3)", async () => {
    respond({ status: 422, body: { detail: "x", code: "AUTH_PASSWORD_TOO_WEAK" } });

    await expect(api.resetPassword("t", "weak")).rejects.toMatchObject({
      code: "AUTH_PASSWORD_TOO_WEAK",
    });
  });
});

describe("changePassword", () => {
  const pair = { access_token: "a2", refresh_token: "r2", token_type: "bearer" };

  function signedIn() {
    const refresh = vi.fn().mockResolvedValue({ accessToken: "a1b", refreshToken: "r1b" });
    const session = createSession({ refresh, logout: vi.fn().mockResolvedValue(undefined) });
    session.signIn({ accessToken: "a1", refreshToken: "r1" });
    return { session, refresh };
  }

  it("sends both passwords with the session's token and continues on the new pair", async () => {
    const fetchMock = respond({ body: pair }, { body: pair });
    const { session } = signedIn();

    await changePassword(session, api, { currentPassword: "temp", newPassword: "mine" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer a1");
    expect(sent(fetchMock).body).toEqual({ current_password: "temp", new_password: "mine" });
    const next = vi.fn().mockResolvedValue(undefined);
    await session.authorized(next);
    expect(next).toHaveBeenCalledWith("a2");
  });

  it("names a wrong current password once a refresh has ruled out an expired token", async () => {
    respond(
      { status: 401, body: { detail: "Current password is incorrect", request_id: "r9" } },
      { status: 401, body: { detail: "Current password is incorrect", request_id: "r10" } },
    );
    const { session, refresh } = signedIn();

    const error = await changePassword(session, api, {
      currentPassword: "wrong",
      newPassword: "mine",
    }).catch((caught: unknown) => caught);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({ code: "CURRENT_PASSWORD_INCORRECT", requestId: "r10" });
    expect(session.isSignedIn()).toBe(true);
  });

  it("leaves a 401 alone when it ended the session", async () => {
    respond({ status: 401, body: { detail: "Invalid token" } });
    const session = createSession({
      refresh: vi.fn().mockRejectedValue(new ApiError(401, undefined)),
      logout: vi.fn().mockResolvedValue(undefined),
    });
    session.signIn({ accessToken: "a1", refreshToken: "r1" });

    const error = await changePassword(session, api, {
      currentPassword: "temp",
      newPassword: "mine",
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ status: 401, code: undefined });
    expect(session.isSignedIn()).toBe(false);
  });

  it("passes an expired temporary password through with its code", async () => {
    const expired = { detail: "x", code: "AUTH_TEMPORARY_PASSWORD_EXPIRED" };
    respond({ status: 401, body: expired }, { status: 401, body: expired });
    const { session } = signedIn();

    await expect(
      changePassword(session, api, { currentPassword: "temp", newPassword: "mine" }),
    ).rejects.toMatchObject({ code: "AUTH_TEMPORARY_PASSWORD_EXPIRED" });
  });
});
