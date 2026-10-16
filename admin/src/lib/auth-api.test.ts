import { afterEach, describe, expect, it, vi } from "vitest";
import { authApi, AuthError } from "./auth-api";
function respond(body: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}
const challenge = {
  mfa_required: true,
  mfa_enrolled: true,
  challenge_token: "challenge-only",
  expires_in: 300,
  methods: ["totp"],
};
const session = {
  role: "admin",
  position: "Dean",
  permissions: ["students:read"],
  access_token: "memory-only",
  expires_in: 900,
};
afterEach(() => vi.unstubAllGlobals());
describe("administrator API boundary", () => {
  it("returns a challenge, never a session, for valid credentials", async () => {
    respond(challenge);
    expect(await authApi.login({ identifier: "admin", password: "test" })).toMatchObject({
      kind: "challenge",
      enrollmentRequired: false,
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({ credentials: "include", cache: "no-store" }),
    );
  });
  it("rejects credentials-only access tokens", async () => {
    respond({ ...challenge, access_token: "early" });
    await expect(authApi.login({ identifier: "admin", password: "test" })).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("restricts unenrolled administrators to setup", async () => {
    respond({ ...challenge, mfa_enrolled: false });
    expect(await authApi.login({ identifier: "admin", password: "test" })).toMatchObject({
      enrollmentRequired: true,
    });
  });
  it("requires an admin role after verification", async () => {
    respond({ ...session, role: "faculty" });
    await expect(authApi.verify("challenge", "123456")).rejects.toMatchObject({
      code: "AUTH_INSUFFICIENT_ROLE",
    });
  });
  it("preserves the server position and permissions", async () => {
    respond(session);
    expect(await authApi.verify("challenge", "123456")).toMatchObject({
      role: "admin",
      position: "Dean",
      permissions: ["students:read"],
    });
  });
  it.each([undefined, "Superadmin"])("rejects missing or invalid position %s", async (position) => {
    respond({ ...session, position });
    await expect(authApi.verify("challenge", "123456")).rejects.toBeInstanceOf(AuthError);
  });
  it("preserves invalid-factor errors and the request reference", async () => {
    respond({ code: "AUTH_MFA_INVALID", request_id: "ref-1" }, 401);
    await expect(authApi.verify("challenge", "000000")).rejects.toMatchObject({
      code: "AUTH_MFA_INVALID",
      requestId: "ref-1",
    });
  });
  it("uses the server lockout duration", async () => {
    const now = Date.now();
    respond({ code: "AUTH_ACCOUNT_LOCKED", retry_after_seconds: 900 }, 423);
    try {
      await authApi.verify("challenge", "000000");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError);
      expect((error as AuthError).retryAt).toBeGreaterThanOrEqual(now + 900000);
    }
  });
  it("handles network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Offline")));
    await expect(authApi.verify("challenge", "123456")).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });
  it("rejects invalid provisioning URIs", async () => {
    respond({ provisioning_uri: "https://example.com", issuer: "PUP", account_name: "admin" });
    await expect(authApi.enroll("challenge")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("does not finish setup when recovery codes are empty", async () => {
    respond({ recovery_codes: [] });
    await expect(authApi.confirmEnrollment("challenge", "123456")).rejects.toMatchObject({
      code: "ENROLLMENT_UNAVAILABLE",
    });
  });
});

describe("additional MFA boundaries", () => {
  it("verifies a browser-generated hardware assertion before returning a session", async () => {
    class BrowserCredential {
      static parseRequestOptionsFromJSON(value: unknown) {
        return value;
      }
      toJSON() {
        return { id: "test-key", type: "public-key", response: { signature: "signed" } };
      }
    }
    vi.stubGlobal("PublicKeyCredential", BrowserCredential);
    vi.stubGlobal("navigator", {
      credentials: { get: vi.fn().mockResolvedValue(new BrowserCredential()) },
    });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ public_key: { challenge: "test-challenge" } })),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(session)));
    vi.stubGlobal("fetch", fetcher);
    expect(await authApi.securityKey("challenge")).toMatchObject({
      role: "admin",
      position: "Dean",
    });
    expect(fetcher).toHaveBeenLastCalledWith(
      expect.stringContaining("/auth/mfa/verify"),
      expect.objectContaining({ body: expect.stringContaining('"assertion"') }),
    );
  });
  it("never treats a cancelled security-key prompt as authentication", async () => {
    class BrowserCredential {
      static parseRequestOptionsFromJSON(value: unknown) {
        return value;
      }
    }
    vi.stubGlobal("PublicKeyCredential", BrowserCredential);
    vi.stubGlobal("navigator", {
      credentials: { get: vi.fn().mockRejectedValue(new Error("cancelled")) },
    });
    respond({ public_key: { challenge: "test" } });
    await expect(authApi.securityKey("challenge")).rejects.toMatchObject({
      code: "WEBAUTHN_CANCELLED",
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
