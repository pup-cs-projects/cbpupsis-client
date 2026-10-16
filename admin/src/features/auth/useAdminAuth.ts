import type { AdminChallenge } from "@cbpupsis/shared/auth";
import { useMutation, useQuery } from "@tanstack/react-query";

import { authApi, session } from "../../lib/auth";
import { createCredential, signChallenge } from "../../lib/webauthn";

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

/** The signed-in admin and their position. A 401 here ends the session. */
export function useMe() {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: () => session.authorized(authApi.me),
    retry: false,
  });
}

export function useSignOut() {
  return useMutation({ mutationFn: () => session.signOut() });
}

type Step = { token: string; code: string };

export function useAdminAuth() {
  // Credentials, challenge tokens, and TOTP secrets must not linger in the mutation cache.
  const options = { gcTime: 0, retry: false } as const;
  const signIn = { onSuccess: session.signIn };

  const login = useMutation({ ...options, mutationFn: authApi.login });
  const enrollment = useMutation({ ...options, mutationFn: authApi.enrollTotp });
  // Every second-factor step below starts the session (AC-103.2); admins get no recovery codes.
  const confirmation = useMutation({
    ...options,
    ...signIn,
    mutationFn: ({ token, code }: Step) => authApi.confirmTotp(token, code),
  });
  const verification = useMutation({
    ...options,
    ...signIn,
    mutationFn: ({ token, code }: Step) => authApi.verify(token, { code }),
  });
  const keyEnrollment = useMutation({
    ...options,
    ...signIn,
    mutationFn: async (token: string) => {
      const credential = await createCredential(await authApi.enrollWebAuthn(token));
      return authApi.confirmWebAuthn(token, credential);
    },
  });
  const securityKey = useMutation({
    ...options,
    ...signIn,
    mutationFn: async (challenge: AdminChallenge) =>
      authApi.verify(challenge.challengeToken, {
        assertion: await signChallenge(challenge.webauthn),
      }),
  });
  return { login, enrollment, confirmation, verification, keyEnrollment, securityKey };
}
