import type { AdminSession, Challenge, Credentials, Enrollment } from "../features/auth/types";

export class AuthError extends Error {
  readonly code: string;
  readonly requestId?: string;
  readonly retryAt?: number;
  constructor(code: string, requestId?: string, retryAt?: number) {
    super(code);
    this.code = code;
    this.requestId = requestId;
    this.retryAt = retryAt;
  }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AuthError("INVALID_RESPONSE");
  return value as Record<string, unknown>;
}
function requiredString(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new AuthError("INVALID_RESPONSE");
  return value;
}
function positiveNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
    throw new AuthError("INVALID_RESPONSE");
  return value;
}
const baseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1").replace(
  /\/$/,
  "",
);
export async function request(
  path: string,
  body?: unknown,
  token?: string,
  method = "POST",
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new AuthError("SERVICE_UNAVAILABLE");
  }
  let data: Record<string, unknown>;
  try {
    data = record(await response.json());
  } catch {
    throw new AuthError(response.ok ? "INVALID_RESPONSE" : "SERVICE_UNAVAILABLE");
  }
  if (!response.ok) {
    const retry = data.retry_after_seconds ?? Number(response.headers.get("Retry-After") ?? NaN);
    throw new AuthError(
      typeof data.code === "string" ? data.code : "AUTH_FAILED",
      typeof data.request_id === "string" ? data.request_id : undefined,
      typeof retry === "number" && Number.isFinite(retry) && retry >= 0
        ? Date.now() + retry * 1000
        : undefined,
    );
  }
  return data;
}
function session(data: Record<string, unknown>): AdminSession {
  if (data.role !== "admin") throw new AuthError("AUTH_INSUFFICIENT_ROLE");
  if (
    !["Chairperson", "Dean", "Registrar"].includes(String(data.position)) ||
    !Array.isArray(data.permissions) ||
    !data.permissions.every((p) => typeof p === "string")
  )
    throw new AuthError("INVALID_RESPONSE");
  return {
    kind: "session",
    role: "admin",
    position: data.position as AdminSession["position"],
    permissions: data.permissions as string[],
    accessToken: requiredString(data.access_token),
    expiresAt: Date.now() + positiveNumber(data.expires_in) * 1000,
  };
}
export const authApi = {
  async login(credentials: Credentials): Promise<Challenge> {
    const data = await request("/auth/login", credentials);
    if (
      data.mfa_required !== true ||
      typeof data.mfa_enrolled !== "boolean" ||
      data.access_token !== undefined
    )
      throw new AuthError("INVALID_RESPONSE");
    if (
      !Array.isArray(data.methods) ||
      !data.methods.every((m) => m === "totp" || m === "webauthn")
    )
      throw new AuthError("INVALID_RESPONSE");
    return {
      kind: "challenge",
      challengeToken: requiredString(data.challenge_token),
      enrollmentRequired: !data.mfa_enrolled,
      expiresAt: Date.now() + positiveNumber(data.expires_in) * 1000,
      methods: data.methods as Challenge["methods"],
    };
  },
  async verify(challengeToken: string, code: string) {
    return session(await request("/auth/mfa/verify", { challenge_token: challengeToken, code }));
  },
  async enroll(challengeToken: string): Promise<Enrollment> {
    const data = await request("/auth/mfa/enroll", undefined, challengeToken);
    let uri: URL;
    try {
      uri = new URL(requiredString(data.provisioning_uri));
    } catch {
      throw new AuthError("INVALID_RESPONSE");
    }
    if (uri.protocol !== "otpauth:" || uri.hostname !== "totp")
      throw new AuthError("INVALID_RESPONSE");
    return {
      secret: requiredString(uri.searchParams.get("secret")),
      accountName: requiredString(data.account_name),
      issuer: requiredString(data.issuer),
      period: positiveNumber(Number(uri.searchParams.get("period") || 30)),
    };
  },
  async confirmEnrollment(challengeToken: string, code: string): Promise<string[]> {
    const data = await request("/auth/mfa/enroll/confirm", { code }, challengeToken);
    if (!Array.isArray(data.recovery_codes) || !data.recovery_codes.length)
      throw new AuthError("ENROLLMENT_UNAVAILABLE");
    return data.recovery_codes.map(requiredString);
  },
  async securityKey(challengeToken: string): Promise<AdminSession> {
    if (
      !window.PublicKeyCredential ||
      !navigator.credentials ||
      !PublicKeyCredential.parseRequestOptionsFromJSON
    )
      throw new AuthError("WEBAUTHN_UNAVAILABLE");
    const data = await request("/auth/mfa/webauthn/options", { challenge_token: challengeToken });
    const options = record(data.public_key);
    requiredString(options.challenge);
    let credential: Credential | null;
    try {
      credential = await navigator.credentials.get({
        publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(
          options as unknown as PublicKeyCredentialRequestOptionsJSON,
        ),
      });
    } catch {
      throw new AuthError("WEBAUTHN_CANCELLED");
    }
    if (!(credential instanceof PublicKeyCredential)) throw new AuthError("WEBAUTHN_CANCELLED");
    return session(
      await request("/auth/mfa/verify", {
        challenge_token: challengeToken,
        assertion: credential.toJSON(),
      }),
    );
  },
};
