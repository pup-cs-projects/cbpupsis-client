import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";
import type { components } from "../api/schema.gen";
import type { Tokens } from "./session";

export type Schemas = components["schemas"];

export type Role = "student" | "faculty" | "admin" | "superadmin";

export type MfaMethod = "totp" | "webauthn";

/** The password step's result for every role that requires MFA. Grants no API access. */
export interface MfaChallenge {
  challengeToken: string;
  /** True on first sign-in: the user must set up an authenticator before verifying. */
  enrollmentRequired: boolean;
  methods: MfaMethod[];
}

export function parseTokens(data: unknown, role: Role): Tokens {
  const body = parse.record(data);
  // The role check is defense in depth: a token pair for another role must never start a
  // session in this app, whatever the API returns.
  parse.literal(body.role, role);
  return {
    accessToken: parse.string(body.access_token),
    refreshToken: parse.string(body.refresh_token),
  };
}

export function parseChallenge(data: unknown, allowed: readonly MfaMethod[]): MfaChallenge {
  const body = parse.record(data);
  if (body.mfa_required !== true) parse.invalid();
  return {
    challengeToken: parse.string(body.challenge_token),
    enrollmentRequired: parse.boolean(body.enrollment_required),
    methods: parse.nonEmptyArray(body.methods).map((method) => parse.oneOf(method, allowed)),
  };
}

/** Refresh and logout look the same for every role; only the path differs. */
export function sessionEndpoints(client: ApiClient, role: Role) {
  const base = `/auth/${role}`;
  return {
    async refresh(refreshToken: string): Promise<Tokens> {
      const body: Schemas["RefreshRequest"] = { refresh_token: refreshToken };
      return parseTokens(await client.request(`${base}/refresh`, { body }), role);
    },
    async logout(refreshToken: string): Promise<void> {
      const body: Schemas["RefreshRequest"] = { refresh_token: refreshToken };
      await client.request(`${base}/logout`, { body });
    },
  };
}
