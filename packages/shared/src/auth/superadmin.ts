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

export interface SuperadminCredentials {
  email: string;
  password: string;
}

export interface SuperadminProfile {
  id: string;
  email: string;
}

/** Superadmin sign-in: password, then TOTP (set up on first sign-in). No recovery codes. */
export function createSuperadminAuthApi(client: ApiClient) {
  return {
    ...sessionEndpoints(client, "superadmin"),

    async login({ email, password }: SuperadminCredentials): Promise<MfaChallenge> {
      const body: Schemas["AdminLoginRequest"] = { email, password };
      return parseChallenge(await client.request("/auth/superadmin/login", { body }), ["totp"]);
    },

    async enrollTotp(challengeToken: string): Promise<TotpSetup> {
      const body: Schemas["TotpEnrollmentRequest"] = { challenge_token: challengeToken };
      const data = parse.record(await client.request("/auth/superadmin/mfa/totp/enroll", { body }));
      return parseProvisioningUri(parse.string(data.provisioning_uri));
    },

    async confirmTotp(challengeToken: string, code: string): Promise<Tokens> {
      const body: Schemas["TotpEnrollmentConfirmRequest"] = {
        challenge_token: challengeToken,
        code,
      };
      return parseTokens(
        await client.request("/auth/superadmin/mfa/totp/confirm", { body }),
        "superadmin",
      );
    },

    async verify(challengeToken: string, code: string): Promise<Tokens> {
      const body: Schemas["TotpEnrollmentConfirmRequest"] = {
        challenge_token: challengeToken,
        code,
      };
      return parseTokens(
        await client.request("/auth/superadmin/mfa/verify", { body }),
        "superadmin",
      );
    },

    async me(accessToken: string): Promise<SuperadminProfile> {
      const body = parse.record(
        await client.request("/superadmin/me", { method: "GET", accessToken }),
      );
      parse.literal(body.role, "superadmin");
      return { id: parse.string(body.id), email: parse.string(body.email) };
    },
  };
}

export type SuperadminAuthApi = ReturnType<typeof createSuperadminAuthApi>;
