import { useMutation, useQuery } from "@tanstack/react-query";

import { authApi, session } from "../../lib/auth";

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

/** The signed-in student. A 401 here ends the session, which sends the app to sign-in. */
export function useMe() {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: () => session.authorized(authApi.me),
    retry: false,
  });
}

export function useSignIn() {
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (tokens) => session.signIn(tokens),
    // Credentials must not linger in the mutation cache.
    gcTime: 0,
  });
}

export function useSignOut() {
  return useMutation({ mutationFn: () => session.signOut() });
}
