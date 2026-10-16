import type { ApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import * as parse from "../api/parse";
import type { Schemas } from "./common";
import type { Session, Tokens } from "./session";

// Password recovery (US-105) and the first-sign-in password change. Every role uses the same
// /auth endpoints; each app's API serves them.

/** A character-class rule the API names in a reset link's `requiredRules`. */
export const CHARACTER_RULES = ["uppercase", "lowercase", "digit", "symbol"] as const;
export type CharacterRule = (typeof CHARACTER_RULES)[number];

export type PasswordRule = "length" | CharacterRule | "different";

export interface PasswordPolicy {
  minimumLength: number;
  /** Rules beyond the length, in the order to list them. */
  rules: readonly Exclude<PasswordRule, "length">[];
}

export interface PasswordCheck {
  rule: PasswordRule;
  label: string;
  met: boolean;
}

/**
 * The rules POST /auth/change-password enforces today: at least 12 characters (its request
 * schema) and not the temporary password itself (its service). The API publishes these
 * nowhere a client can read them, unlike a reset link's rules, so they are mirrored here and
 * must change when the API's do.
 */
export const CHANGE_PASSWORD_POLICY: PasswordPolicy = { minimumLength: 12, rules: ["different"] };

// The same character classes as the API's check_password_complexity (Python's str methods),
// so the checklist and the API never disagree about a letter outside A to Z.
const TESTS: Record<CharacterRule, RegExp> = {
  uppercase: /\p{Lu}/u,
  lowercase: /\p{Ll}/u,
  digit: /\p{Nd}/u,
  symbol: /[^\p{L}\p{N}\s]/u,
};

const LABELS: Record<Exclude<PasswordRule, "length">, string> = {
  uppercase: "An uppercase letter",
  lowercase: "A lowercase letter",
  digit: "A number",
  symbol: "A symbol, such as ! # or @",
  different: "Different from your temporary password",
};

/**
 * Check a password against a policy, rule by rule, for a live checklist. Advisory only: the
 * API checks again and has the final word.
 */
export function checkPassword(
  policy: PasswordPolicy,
  password: string,
  context: { current?: string } = {},
): PasswordCheck[] {
  // Python's len() counts code points, not UTF-16 units.
  const length = [...password].length;
  return [
    {
      rule: "length",
      label: `At least ${policy.minimumLength} characters`,
      met: length >= policy.minimumLength,
    },
    ...policy.rules.map((rule) => ({
      rule,
      label: LABELS[rule],
      met:
        rule === "different"
          ? password.length > 0 && password !== context.current
          : TESTS[rule].test(password),
    })),
  ];
}

export function meetsPolicy(checks: readonly PasswordCheck[]): boolean {
  return checks.every((check) => check.met);
}

/**
 * The API answers an unknown reset token, and a wrong current password, with a bare 401 and
 * no code. Each gets a client-side code here so a page can say what happened.
 */
function rename(error: unknown, code: "RESET_LINK_INVALID" | "CURRENT_PASSWORD_INCORRECT") {
  return error instanceof ApiError && error.status === 401 && error.code === undefined
    ? new ApiError(401, code, { requestId: error.requestId })
    : error;
}

export function createPasswordApi(client: ApiClient) {
  return {
    /** Always 202 with the same body, whether or not the address has an account. */
    async requestReset(email: string): Promise<void> {
      const body: Schemas["ForgotPasswordRequest"] = { email };
      await client.request("/auth/forgot-password", { body });
    },

    /** Check a reset link without spending it, and read the rules its new password must meet. */
    async checkResetLink(token: string): Promise<PasswordPolicy> {
      const body: Schemas["VerifyResetTokenRequest"] = { token, verify_only: true };
      try {
        const data = parse.record(await client.request("/auth/reset-password", { body }));
        if (data.valid !== true) parse.invalid();
        const named = Array.isArray(data.requiredRules) ? data.requiredRules : [];
        return {
          minimumLength: parse.positiveNumber(data.minimumLength),
          // A rule this client does not know cannot be checked live; the API still enforces it.
          rules: CHARACTER_RULES.filter((rule) => named.includes(rule)),
        };
      } catch (error) {
        throw rename(error, "RESET_LINK_INVALID");
      }
    },

    /** Spend the link. Every session the account had is ended (AC-105.6). */
    async resetPassword(token: string, newPassword: string): Promise<{ sessionsRevoked: number }> {
      const body: Schemas["ResetPasswordRequest"] = { token, new_password: newPassword };
      try {
        const data = parse.record(await client.request("/auth/reset-password", { body }));
        return { sessionsRevoked: parse.nonNegativeInteger(data.sessionsRevoked) };
      } catch (error) {
        throw rename(error, "RESET_LINK_INVALID");
      }
    },

    /** Replace the signed-in account's password. Returns the pair that replaces every session. */
    async changePassword(
      accessToken: string,
      passwords: { currentPassword: string; newPassword: string },
    ): Promise<Tokens> {
      const body: Schemas["ChangePasswordRequest"] = {
        current_password: passwords.currentPassword,
        new_password: passwords.newPassword,
      };
      const data = parse.record(
        await client.request("/auth/change-password", { body, accessToken }),
      );
      // This pair carries no role field, unlike the role sign-ins, so there is none to check.
      return {
        accessToken: parse.string(data.access_token),
        refreshToken: parse.string(data.refresh_token),
      };
    },
  };
}

export type PasswordApi = ReturnType<typeof createPasswordApi>;

/**
 * Change the password through the session, then continue the session on the new pair.
 *
 * A 401 the session could not cure by refreshing ends the session; so a bare 401 that leaves
 * the session signed in came from the current-password check itself.
 */
export async function changePassword(
  session: Session,
  api: PasswordApi,
  passwords: { currentPassword: string; newPassword: string },
): Promise<void> {
  try {
    const tokens = await session.authorized((token) => api.changePassword(token, passwords));
    session.signIn(tokens);
  } catch (error) {
    throw session.isSignedIn() ? rename(error, "CURRENT_PASSWORD_INCORRECT") : error;
  }
}

/** Why a reset link cannot be used, or null when the error is about something else. */
export function resetLinkProblem(error: unknown): "expired" | "used" | "invalid" | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === "AUTH_RESET_TOKEN_EXPIRED") return "expired";
  if (error.code === "AUTH_RESET_TOKEN_USED") return "used";
  if (error.code === "RESET_LINK_INVALID") return "invalid";
  return null;
}
