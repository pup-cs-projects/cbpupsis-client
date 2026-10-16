import { isPasswordChangeRequired } from "@cbpupsis/shared/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { authApi, session } from "../../lib/auth";

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

// Sign-in steps hold credentials, challenge tokens, and TOTP secrets: none may linger in the
// mutation cache once the step is done.
const transient = { gcTime: 0, retry: false } as const;

const meQuery = {
  queryKey: authKeys.me(),
  queryFn: () => session.authorized(authApi.me),
  retry: false,
} as const;

/** The signed-in superadmin. A 401 here ends the session, which sends the app to sign-in. */
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

/** Password step. Its result is only a challenge (AC-104.1). */
export function usePasswordStep() {
  return useMutation({ ...transient, mutationFn: authApi.login });
}

export function useTotpEnrollment() {
  return useMutation({ ...transient, mutationFn: authApi.enrollTotp });
}

/** Confirming the first code, or verifying a later one, both start the session. */
export function useSecondFactor() {
  return useMutation({
    ...transient,
    mutationFn: ({
      challengeToken,
      code,
      enrolling,
    }: {
      challengeToken: string;
      code: string;
      enrolling: boolean;
    }) =>
      enrolling ? authApi.confirmTotp(challengeToken, code) : authApi.verify(challengeToken, code),
    onSuccess: (tokens) => session.signIn(tokens),
  });
}

export function useSignOut() {
  return useMutation({ mutationFn: () => session.signOut() });
}
