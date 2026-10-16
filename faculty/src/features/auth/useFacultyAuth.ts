import type { FacultySecondFactor } from "@cbpupsis/shared/auth";
import { useMutation, useQuery } from "@tanstack/react-query";

import { authApi, session } from "../../lib/auth";

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

/** The signed-in faculty member. A 401 here ends the session, which sends the app to sign-in. */
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
