import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import { createAdminAuthApi } from "./admin";
import { createFacultyAuthApi } from "./faculty";
import { createStudentAuthApi } from "./student";
import { createSuperadminAuthApi } from "./superadmin";
import { parseProvisioningUri } from "./totp";

const client = createApiClient("http://api.test/api/v1");

function respond(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sent(fetchMock: ReturnType<typeof respond>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, body: JSON.parse(String(init.body)) as unknown };
}

const pair = (role: string) => ({
  access_token: "a",
  refresh_token: "r",
  token_type: "bearer",
  role,
  expires_in: 900,
});

afterEach(() => vi.unstubAllGlobals());

describe("student auth", () => {
  it("signs in with student number, birthdate, and password in the API's field names (AC-101.1)", async () => {
    const fetchMock = respond(pair("student"));

    const tokens = await createStudentAuthApi(client).login({
      studentNumber: "2021-00123-MN-0",
      birthdate: "2003-04-05",
      password: "secret",
    });

    expect(sent(fetchMock)).toEqual({
      url: "http://api.test/api/v1/auth/student/login",
      body: { student_number: "2021-00123-MN-0", birthdate: "2003-04-05", password: "secret" },
    });
    expect(tokens).toEqual({ accessToken: "a", refreshToken: "r" });
  });

  it("refuses a token pair issued for another role", async () => {
    respond(pair("faculty"));

    await expect(
      createStudentAuthApi(client).login({ studentNumber: "x", birthdate: "x", password: "x" }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});

describe("faculty auth", () => {
  it("gets only a challenge from the password step, never tokens (AC-102.1)", async () => {
    respond({
      mfa_required: true,
      challenge_token: "c",
      enrollment_required: true,
      methods: ["totp"],
    });

    await expect(
      createFacultyAuthApi(client).login({ employeeId: "2021-00456-MN-0", password: "p" }),
    ).resolves.toEqual({ challengeToken: "c", enrollmentRequired: true, methods: ["totp"] });
  });

  it("returns the session and the recovery codes when enrollment is confirmed (AC-102.2)", async () => {
    respond({ ...pair("faculty"), recovery_codes: ["one", "two"] });

    const result = await createFacultyAuthApi(client).confirmTotp("c", "123456");

    expect(result).toEqual({
      tokens: { accessToken: "a", refreshToken: "r" },
      recoveryCodes: ["one", "two"],
    });
  });

  it("verifies with a recovery code in place of an app code", async () => {
    const fetchMock = respond(pair("faculty"));

    await createFacultyAuthApi(client).verify("c", { recoveryCode: "ABCD-EFGH" });

    expect(sent(fetchMock).body).toEqual({ challenge_token: "c", recovery_code: "ABCD-EFGH" });
  });
});

describe("admin auth", () => {
  it("carries the security-key challenge with the password step's result (AC-103.1)", async () => {
    respond({
      mfa_required: true,
      challenge_token: "c",
      enrollment_required: false,
      methods: ["totp", "webauthn"],
      webauthn_challenge: "w",
      webauthn_rp_id: "admin.cbpupsis",
      webauthn_credential_id: "cred",
    });

    const challenge = await createAdminAuthApi(client).login({
      email: "a@pup.edu.ph",
      password: "p",
    });

    expect(challenge.webauthn).toEqual({
      challenge: "w",
      rpId: "admin.cbpupsis",
      credentialId: "cred",
    });
  });

  it("reads the admin's position from /admin/me, including finance", async () => {
    const fetchMock = respond({
      role: "admin",
      id: "i",
      email: "a@pup.edu.ph",
      position: "finance",
    });

    const profile = await createAdminAuthApi(client).me("a");

    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("http://api.test/api/v1/admin/me");
    expect(profile.position).toBe("finance");
  });
});

describe("superadmin auth", () => {
  it("verifies with the code only", async () => {
    const fetchMock = respond(pair("superadmin"));

    await createSuperadminAuthApi(client).verify("c", "123456");

    expect(sent(fetchMock)).toEqual({
      url: "http://api.test/api/v1/auth/superadmin/mfa/verify",
      body: { challenge_token: "c", code: "123456" },
    });
  });
});

describe("parseProvisioningUri", () => {
  it("reads the setup key, issuer, and account from the otpauth URI", () => {
    expect(
      parseProvisioningUri(
        "otpauth://totp/CBPUPSIS:ana%40pup.edu.ph?secret=ABC234&issuer=CBPUPSIS",
      ),
    ).toMatchObject({
      secret: "ABC234",
      issuer: "CBPUPSIS",
      accountName: "ana@pup.edu.ph",
      period: 30,
    });
  });

  it("rejects a URI that is not a TOTP provisioning URI", () => {
    expect(() => parseProvisioningUri("https://example.com/?secret=x")).toThrow(ApiError);
  });
});
