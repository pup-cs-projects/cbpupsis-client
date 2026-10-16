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

export interface AdminCredentials {
  email: string;
  password: string;
}

export const ADMIN_POSITIONS = ["chairperson", "dean", "finance", "registrar"] as const;
export type AdminPosition = (typeof ADMIN_POSITIONS)[number];

export interface AdminProfile {
  id: string;
  email: string;
  position: AdminPosition;
  departmentId: string | null;
  collegeId: string | null;
}

/** The admin challenge also carries what a security-key assertion needs. */
export interface AdminChallenge extends MfaChallenge {
  webauthn: {
    /** base64url challenge to sign. */
    challenge: string;
    rpId: string;
    /** The enrolled key, or null when the admin has none. */
    credentialId: string | null;
  };
}

/**
 * Browser WebAuthn JSON (`PublicKeyCredential.toJSON()` or @simplewebauthn/browser). Opaque
 * here: the API verifies it, so the client passes it through unchanged.
 */
export type WebAuthnJson = Record<string, unknown>;

export type AdminSecondFactor = { code: string } | { assertion: WebAuthnJson };

/** Admin sign-in: password, then TOTP or a security key (one set up on first sign-in). */
export function createAdminAuthApi(client: ApiClient) {
  return {
    ...sessionEndpoints(client, "admin"),

    async login({ email, password }: AdminCredentials): Promise<AdminChallenge> {
      const body: Schemas["AdminLoginRequest"] = { email, password };
      const data = await client.request("/auth/admin/login", { body });
      const raw = parse.record(data);
      return {
        ...parseChallenge(data, ["totp", "webauthn"]),
        webauthn: {
          challenge: parse.string(raw.webauthn_challenge),
          rpId: parse.string(raw.webauthn_rp_id),
          credentialId: parse.optionalString(raw.webauthn_credential_id),
        },
      };
    },

    async enrollTotp(challengeToken: string): Promise<TotpSetup> {
      const body: Schemas["TotpEnrollmentRequest"] = { challenge_token: challengeToken };
      const data = parse.record(await client.request("/auth/admin/mfa/totp/enroll", { body }));
      return parseProvisioningUri(parse.string(data.provisioning_uri));
    },

    async confirmTotp(challengeToken: string, code: string): Promise<Tokens> {
      const body: Schemas["TotpEnrollmentConfirmRequest"] = {
        challenge_token: challengeToken,
        code,
      };
      return parseTokens(await client.request("/auth/admin/mfa/totp/confirm", { body }), "admin");
    },

    /** Registration options for `navigator.credentials.create`, as WebAuthn JSON. */
    async enrollWebAuthn(challengeToken: string): Promise<WebAuthnJson> {
      const body: Schemas["WebAuthnEnrollmentRequest"] = { challenge_token: challengeToken };
      const data = parse.record(await client.request("/auth/admin/mfa/webauthn/enroll", { body }));
      return parse.record(data.public_key);
    },

    async confirmWebAuthn(challengeToken: string, credential: WebAuthnJson): Promise<Tokens> {
      const body: Schemas["WebAuthnEnrollmentConfirmRequest"] = {
        challenge_token: challengeToken,
        credential,
      };
      return parseTokens(
        await client.request("/auth/admin/mfa/webauthn/confirm", { body }),
        "admin",
      );
    },

    async verify(challengeToken: string, factor: AdminSecondFactor): Promise<Tokens> {
      const body: Schemas["MfaVerifyRequest"] =
        "code" in factor
          ? { challenge_token: challengeToken, code: factor.code }
          : { challenge_token: challengeToken, assertion: factor.assertion };
      return parseTokens(await client.request("/auth/admin/mfa/verify", { body }), "admin");
    },

    async me(accessToken: string): Promise<AdminProfile> {
      const body = parse.record(await client.request("/admin/me", { method: "GET", accessToken }));
      parse.literal(body.role, "admin");
      return {
        id: parse.string(body.id),
        email: parse.string(body.email),
        position: parse.oneOf(body.position, ADMIN_POSITIONS),
        departmentId: parse.optionalString(body.department_id),
        collegeId: parse.optionalString(body.college_id),
      };
    },
  };
}

export type AdminAuthApi = ReturnType<typeof createAdminAuthApi>;
