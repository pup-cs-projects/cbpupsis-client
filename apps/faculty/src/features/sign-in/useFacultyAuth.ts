import { isPasswordChangeRequired } from "@cbpupsis/shared/api";
import type { FacultySecondFactor } from "@cbpupsis/shared/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { authApi, session } from "../../lib/auth";

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

const meQuery = {
  queryKey: authKeys.me(),
  queryFn: () => session.authorized(authApi.me),
  retry: false,
} as const;

/** The signed-in faculty member. A 401 here ends the session, which sends the app to sign-in. */
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
        // Anything else is the dashboard's to show, with its own retry.
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

export function useFacultyAuth() {
  // Credentials, challenge tokens, and TOTP secrets must not linger in the mutation cache.
  const options = { gcTime: 0, retry: false } as const;
  const login = useMutation({ ...options, mutationFn: authApi.login });
  const enrollment = useMutation({ ...options, mutationFn: authApi.enrollTotp });
  const confirmation = useMutation({
    ...options,
    mutationFn: ({ token, code }: { token: string; code: string }) =>
      authApi.confirmTotp(token, code),
    // Confirming signs in at once (AC-102.2); the page still shows the recovery codes first.
    onSuccess: (result) => session.signIn(result.tokens),
  });
  const verification = useMutation({
    ...options,
    mutationFn: ({ token, factor }: { token: string; factor: FacultySecondFactor }) =>
      authApi.verify(token, factor),
    onSuccess: (tokens) => session.signIn(tokens),
  });
  return { login, enrollment, confirmation, verification };
}
