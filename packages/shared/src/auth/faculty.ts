import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";
import {
  parseChallenge,
  parseTokens,
  sessionEndpoints,
  type MfaChallenge,
  type Schemas,
} from "./common";
import type { Tokens } from "./session";
import { parseProvisioningUri, type TotpSetup } from "./totp";

export interface FacultyCredentials {
  /** YYYY-NNNNN-XX-N. The API checks the format and answers AUTH_ID_FORMAT_INVALID. */
  employeeId: string;
  password: string;
}

export interface FacultyProfile {
  id: string;
  email: string;
  employeeId: string | null;
}

/** Either the six-digit code from the app, or a one-time recovery code. */
export type FacultySecondFactor = { code: string } | { recoveryCode: string };

/** Faculty sign-in: password, then TOTP (set up on first sign-in). */
export function createFacultyAuthApi(client: ApiClient) {
  return {
    ...sessionEndpoints(client, "faculty"),

    async login({ employeeId, password }: FacultyCredentials): Promise<MfaChallenge> {
      const body: Schemas["FacultyLoginRequest"] = { employee_id: employeeId, password };
      return parseChallenge(await client.request("/auth/faculty/login", { body }), ["totp"]);
    },

    async enrollTotp(challengeToken: string): Promise<TotpSetup> {
      const body: Schemas["ChallengeRequest"] = { challenge_token: challengeToken };
      const data = parse.record(await client.request("/auth/faculty/mfa/totp/enroll", { body }));
      return parseProvisioningUri(parse.string(data.provisioning_uri));
    },

    /** Confirming enrollment also signs in, and returns recovery codes shown exactly once. */
    async confirmTotp(
      challengeToken: string,
      code: string,
    ): Promise<{ tokens: Tokens; recoveryCodes: string[] }> {
      const body: Schemas["TotpConfirmRequest"] = { challenge_token: challengeToken, code };
      const data = await client.request("/auth/faculty/mfa/totp/confirm", { body });
      return {
        tokens: parseTokens(data, "faculty"),
        recoveryCodes: parse.stringArray(parse.record(data).recovery_codes),
      };
    },

    async verify(challengeToken: string, factor: FacultySecondFactor): Promise<Tokens> {
      const body: Schemas["FacultyMfaVerifyRequest"] =
        "code" in factor
          ? { challenge_token: challengeToken, code: factor.code }
          : { challenge_token: challengeToken, recovery_code: factor.recoveryCode };
      return parseTokens(await client.request("/auth/faculty/mfa/verify", { body }), "faculty");
    },

    async me(accessToken: string): Promise<FacultyProfile> {
      const body = parse.record(
        await client.request("/auth/faculty/me", { method: "GET", accessToken }),
      );
      parse.literal(body.role, "faculty");
      return {
        id: parse.string(body.id),
        email: parse.string(body.email),
        employeeId: parse.optionalString(body.employee_id),
      };
    },
  };
}

export type FacultyAuthApi = ReturnType<typeof createFacultyAuthApi>;
