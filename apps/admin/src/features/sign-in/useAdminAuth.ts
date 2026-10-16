import { isPasswordChangeRequired } from "@cbpupsis/shared/api";
import type { AdminChallenge } from "@cbpupsis/shared/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { authApi, session } from "../../lib/auth";
import { createCredential, signChallenge } from "../../lib/webauthn";

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

const meQuery = {
  queryKey: authKeys.me(),
  queryFn: () => session.authorized(authApi.me),
  retry: false,
} as const;

/** The signed-in admin and their position. A 401 here ends the session. */
export function useMe() {
  return useQuery(meQuery);
}

/**
 * The last step of signing in: load the account, then open the portal. An account that still
 * holds a temporary password goes to the password change instead (SessionWatcher sends it), so
 * the dashboard never flashes first.
 */
export function useEnterPortal() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => {
      try {
        await queryClient.fetchQuery(meQuery);
      } catch (error) {
        if (isPasswordChangeRequired(error)) return "change-password" as const;
        // Anything else is shown by the dashboard, with its own retry.
      }
      return "portal" as const;
    },
    onSuccess: (next) => {
      // A session that ended meanwhile has already gone back to sign-in, with the reason.
      if (next === "portal" && session.isSignedIn()) {
        void navigate({ to: "/dashboard", replace: true });
      }
    },
  });
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
