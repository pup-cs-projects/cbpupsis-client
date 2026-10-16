import type { AuthResult, Credentials, Enrollment, FacultySession } from "../features/auth/types";

const baseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1").replace(
  /\/$/,
  "",
);

export class AuthError extends Error {
  code: string;
  requestId?: string;
  retryAt?: number;
  constructor(code: string, requestId?: string, retryAt?: number) {
    super(code);
    this.name = "AuthError";
    this.code = code;
    this.requestId = requestId;
    this.retryAt = retryAt;
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AuthError("INVALID_RESPONSE");
  return value as Record<string, unknown>;
}
function requiredString(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new AuthError("INVALID_RESPONSE");
  return value;
}

async function request(
  path: string,
  body?: unknown,
  token?: string,
  method = "POST",
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(baseUrl + path, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
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
    const retry =
      data.retry_after_seconds ??
      (response.headers.get("Retry-After")
        ? Number(response.headers.get("Retry-After"))
        : undefined);
    throw new AuthError(
      typeof data.code === "string" ? data.code : "AUTH_FAILED",
      typeof data.request_id === "string" ? data.request_id : undefined,
      typeof retry === "number" && Number.isFinite(retry) && retry >= 0
        ? Date.now() + retry * 1000
        : undefined,
    );
  }
  if (data.status !== "success") throw new AuthError("INVALID_RESPONSE");
  return record(data.data);
}

export const authApi = {
  async login(credentials: Credentials): Promise<AuthResult> {
    const data = await request("/faculty-auth/login", {
      identifier: credentials.employee_id,
      password: credentials.password,
      birthday: credentials.date_of_birth,
    });
    if (
      data.mfa_required !== true ||
      typeof data.mfa_enrolled !== "boolean" ||
      typeof data.expires_in !== "number" ||
      !Number.isFinite(data.expires_in) ||
      data.expires_in <= 0
    ) {
      throw new AuthError("INVALID_RESPONSE");
    }
    return {
      kind: "challenge",
      challengeToken: requiredString(data.challenge_token),
      enrollmentRequired: !data.mfa_enrolled,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
  },
  async verify(challengeToken: string, code: string): Promise<FacultySession> {
    const data = await request("/faculty-auth/mfa/verify", {
      challenge_token: challengeToken,
      code,
    });
    if (data.role !== "faculty" || typeof data.expiresIn !== "number" || data.expiresIn <= 0)
      throw new AuthError("INVALID_RESPONSE");
    return {
      kind: "session",
      role: "faculty",
      accessToken: requiredString(data.accessToken),
      expiresAt: Date.now() + data.expiresIn * 1000,
    };
  },
  async enroll(challengeToken: string): Promise<Enrollment> {
    const data = await request("/faculty-auth/mfa/enroll", undefined, challengeToken);
    let uri: URL;
    try {
      uri = new URL(requiredString(data.provisioning_uri));
    } catch {
      throw new AuthError("INVALID_RESPONSE");
    }
    if (uri.protocol !== "otpauth:" || uri.hostname !== "totp")
      throw new AuthError("INVALID_RESPONSE");
    const period = Number(uri.searchParams.get("period") || 30);
    if (!Number.isFinite(period) || period <= 0) throw new AuthError("INVALID_RESPONSE");
    return {
      secret: requiredString(uri.searchParams.get("secret")),
      accountName: requiredString(data.account_name),
      issuer: requiredString(data.issuer),
      period,
    };
  },
  async confirmEnrollment(challengeToken: string, code: string): Promise<string[]> {
    const data = await request("/faculty-auth/mfa/enroll/confirm", { code }, challengeToken);
    if (!Array.isArray(data.recovery_codes) || data.recovery_codes.length === 0)
      throw new AuthError("ENROLLMENT_UNAVAILABLE");
    return data.recovery_codes.map(requiredString);
  },
};
