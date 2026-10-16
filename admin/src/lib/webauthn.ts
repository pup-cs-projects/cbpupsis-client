import { ApiError } from "@cbpupsis/shared/api";
import type { AdminChallenge, WebAuthnJson } from "@cbpupsis/shared/auth";
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/browser";

// The browser half of security keys. The API speaks py_webauthn's JSON, which is the same JSON
// @simplewebauthn/browser reads and writes, so nothing is converted by hand here.

function ensureSupported() {
  if (!browserSupportsWebAuthn()) throw new ApiError(0, "WEBAUTHN_UNAVAILABLE");
}

/** A cancelled prompt, a timeout, and a refused key all read the same to the person. */
async function prompt<T>(ceremony: () => Promise<T>): Promise<T> {
  try {
    return await ceremony();
  } catch {
    throw new ApiError(0, "WEBAUTHN_CANCELLED");
  }
}

/** Register a new security key from the API's registration options. */
export async function createCredential(options: WebAuthnJson): Promise<WebAuthnJson> {
  ensureSupported();
  const credential = await prompt(() =>
    startRegistration({
      optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON,
    }),
  );
  return credential as unknown as WebAuthnJson;
}

/** Sign the login challenge with the admin's enrolled key. */
export async function signChallenge(webauthn: AdminChallenge["webauthn"]): Promise<WebAuthnJson> {
  ensureSupported();
  const assertion = await prompt(() =>
    startAuthentication({
      optionsJSON: {
        challenge: webauthn.challenge,
        rpId: webauthn.rpId,
        allowCredentials: webauthn.credentialId
          ? [{ id: webauthn.credentialId, type: "public-key" }]
          : [],
        // The API verifies with require_user_verification=True.
        userVerification: "required",
      },
    }),
  );
  return assertion as unknown as WebAuthnJson;
}
