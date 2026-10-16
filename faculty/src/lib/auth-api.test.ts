import { afterEach, describe, expect, it, vi } from "vitest";
import { authApi } from "./auth-api";

const credentials = {
  employee_id: "2021-00456-MN-0",
  password: "test-password",
  date_of_birth: "1980-02-15",
};
function reply(data: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(data), { status }))),
  );
}
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("faculty API contract", () => {
  it("sends identifier and birthday and returns only the challenge after password authentication", async () => {
    reply({
      status: "success",
      data: {
        mfa_required: true,
        mfa_enrolled: true,
        expires_in: 300,
        challenge_token: "challenge",
        accessToken: "must-not-use",
      },
    });
    const result = await authApi.login(credentials);
    expect(result.kind).toBe("challenge");
    expect(result).not.toHaveProperty("accessToken");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/faculty-auth/login"),
      expect.objectContaining({
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          identifier: credentials.employee_id,
          password: credentials.password,
          birthday: credentials.date_of_birth,
        }),
      }),
    );
  });
  it("fails closed if password authentication returns a session instead of a challenge", async () => {
    reply({ status: "success", data: { accessToken: "unexpected", role: "faculty" } });
    await expect(authApi.login(credentials)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("rejects a second-factor session for another role", async () => {
    reply({
      status: "success",
      data: { accessToken: "unexpected", role: "admin", expiresIn: 1800 },
    });
    await expect(authApi.verify("challenge", "123456")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });
  it("accepts a faculty session only from verification", async () => {
    reply({
      status: "success",
      data: { accessToken: "faculty-session", role: "faculty", expiresIn: 1800 },
    });
    await expect(authApi.verify("challenge", "123456")).resolves.toMatchObject({
      kind: "session",
      role: "faculty",
    });
  });
  it("uses the server lockout duration and preserves its request reference", async () => {
    reply(
      { code: "AUTH_ACCOUNT_LOCKED", retry_after_seconds: 900, request_id: "test-reference" },
      423,
    );
    const now = Date.now();
    await expect(authApi.login(credentials)).rejects.toMatchObject({
      code: "AUTH_ACCOUNT_LOCKED",
      requestId: "test-reference",
      retryAt: expect.any(Number),
    });
    try {
      await authApi.login(credentials);
    } catch (error) {
      expect((error as { retryAt: number }).retryAt).toBeGreaterThanOrEqual(now + 900_000);
    }
  });
  it.each(["AUTH_MFA_INVALID", "AUTH_MFA_CODE_REUSED"])(
    "preserves API rejection %s",
    async (code) => {
      reply({ code }, 401);
      await expect(authApi.verify("challenge", "000000")).rejects.toMatchObject({ code });
    },
  );
  it("extracts a manual setup key from the server provisioning URI", async () => {
    reply({
      status: "success",
      data: {
        provisioning_uri: "otpauth://totp/Faculty?secret=TESTSECRET&period=45",
        account_name: "test-faculty",
        issuer: "PUP CBPUPSIS",
      },
    });
    await expect(authApi.enroll("challenge")).resolves.toMatchObject({
      secret: "TESTSECRET",
      period: 45,
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/faculty-auth/mfa/enroll"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer challenge" }),
      }),
    );
  });
  it("rejects empty recovery codes instead of advancing", async () => {
    reply({ status: "success", data: { recovery_codes: [] } });
    await expect(authApi.confirmEnrollment("challenge", "123456")).rejects.toMatchObject({
      code: "ENROLLMENT_UNAVAILABLE",
    });
  });
  it("handles a network outage without exposing credentials", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private server detail")));
    await expect(authApi.login(credentials)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  });
});
