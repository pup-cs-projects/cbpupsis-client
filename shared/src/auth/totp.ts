import { ApiError } from "../api/errors";

export interface TotpSetup {
  /** The `otpauth://` URI, encoded into the QR code. */
  uri: string;
  /** The base32 key, for typing into an app that cannot scan. */
  secret: string;
  issuer: string;
  accountName: string;
  /** Seconds each code is valid for. */
  period: number;
}

/**
 * Read an `otpauth://totp/Issuer:account?secret=...` provisioning URI.
 *
 * Superadmin enrollment returns only the URI, so the setup key shown to the user is read from
 * it rather than from a separate field, the same way for every role.
 */
export function parseProvisioningUri(uri: string): TotpSetup {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new ApiError(0, "INVALID_RESPONSE");
  }
  const secret = url.searchParams.get("secret");
  if (url.protocol !== "otpauth:" || url.hostname !== "totp" || !secret) {
    throw new ApiError(0, "INVALID_RESPONSE");
  }
  const label = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const [labelIssuer, accountName = label] = label.includes(":")
    ? label.split(":", 2)
    : ["", label];
  const period = Number(url.searchParams.get("period") ?? 30);
  return {
    uri,
    secret,
    issuer: url.searchParams.get("issuer") ?? labelIssuer,
    accountName,
    period: Number.isFinite(period) && period > 0 ? period : 30,
  };
}
