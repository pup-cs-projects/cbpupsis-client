import { useMutation } from "@tanstack/react-query";

import { useAccount } from "../context";

/** End the session on the API. The session watcher then returns to sign-in. */
export function useSignOut() {
  const { session } = useAccount();
  return useMutation({ mutationFn: () => session.signOut() });
}
