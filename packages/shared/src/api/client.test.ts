import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "./client";
import { ApiError, errorMessage, isChallengeRejected, isThrottled } from "./errors";

const client = createApiClient("http://api.test/api/v1/");

function respond(status: number, body?: unknown, headers: Record<string, string> = {}) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(body === undefined ? null : JSON.stringify(body), { status, headers }),
    );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  if (!(error instanceof ApiError)) throw new Error("expected an ApiError");
  return error;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("createApiClient", () => {
  it("joins the path to the base URL and sends the access token as a bearer token", async () => {
    const fetchMock = respond(200, { ok: true });

    await client.request("/auth/student/me", { method: "GET", accessToken: "abc" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/v1/auth/student/me");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer abc");
  });

  it("returns undefined for 204 No Content", async () => {
    respond(204);

    await expect(client.request("/auth/student/logout")).resolves.toBeUndefined();
  });

  it("branches on the envelope's code and keeps the request id for bug reports", async () => {
    respond(401, { detail: "Sign-in failed", request_id: "req-1", code: "AUTH_FAILED" });

    const error = await rejection(client.request("/auth/student/login"));

    expect(error).toMatchObject({ status: 401, code: "AUTH_FAILED", requestId: "req-1" });
  });

  it("reads a lockout's wait from the body (AC-101.4)", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    respond(423, { detail: "Locked", code: "AUTH_ACCOUNT_LOCKED", retry_after_seconds: 90 });

    const error = await rejection(client.request("/auth/student/login"));

    expect(error.retryAt).toBe(1_000_000 + 90_000);
    expect(isThrottled(error)).toBe(true);
  });

  it("reads a rate limit's wait from Retry-After when the body has none", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    respond(429, { detail: "Too many", code: "rate_limited" }, { "Retry-After": "30" });

    const error = await rejection(client.request("/auth/student/login"));

    expect(error.retryAt).toBe(1_000_000 + 30_000);
  });

  it("reports a request that never reached the API as a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await rejection(client.request("/auth/student/login"));

    expect(error).toMatchObject({ status: 0, code: "NETWORK_ERROR" });
  });

  it("reports an unreadable success body as an invalid response, not as data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })));

    const error = await rejection(client.request("/auth/student/login"));

    expect(error.code).toBe("INVALID_RESPONSE");
  });
});

describe("errorMessage", () => {
  it("never shows the API's detail prose, only copy keyed by code", () => {
    const error = new ApiError(401, "AUTH_FAILED", { message: "internal wording" });

    expect(errorMessage(error)).not.toContain("internal wording");
    expect(errorMessage(error)).toMatch(/do not match/);
  });

  it("treats a bare 401 as a rejected challenge, distinct from a wrong code", () => {
    expect(isChallengeRejected(new ApiError(401, undefined))).toBe(true);
    expect(isChallengeRejected(new ApiError(401, "AUTH_MFA_INVALID"))).toBe(false);
  });

  it("falls back to a generic sentence for an unknown code or a non-API error", () => {
    expect(errorMessage(new ApiError(500, "SOMETHING_NEW"))).toMatch(/try again/);
    expect(errorMessage(new Error("boom"))).toMatch(/try again/);
  });
});
