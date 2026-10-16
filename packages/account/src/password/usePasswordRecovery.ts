import { ApiError } from "@cbpupsis/shared/api";
import { changePassword } from "@cbpupsis/shared/auth";
import { useMutation, useQuery } from "@tanstack/react-query";

import { useAccount } from "../context";

export const passwordKeys = {
  all: ["password"] as const,
  resetLink: (token: string) => [...passwordKeys.all, "reset-link", token] as const,
};

// Passwords and reset tokens must not linger in the mutation cache once a step is done.
const transient = { gcTime: 0, retry: false } as const;

/** Ask for a reset link. The answer is the same whether or not the address has an account. */
export function useRequestReset() {
  const { passwordApi } = useAccount();
  return useMutation({ ...transient, mutationFn: passwordApi.requestReset });
}

/**
 * Check a reset link before asking for a password, without spending it. A dropped connection
 * is retried once, for a phone on weak signal; the API's answers are final.
 */
export function useResetLink(token: string | undefined) {
  const { passwordApi } = useAccount();
  return useQuery({
    queryKey: passwordKeys.resetLink(token ?? ""),
    queryFn: () => passwordApi.checkResetLink(token ?? ""),
    enabled: Boolean(token),
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: (failures, error) => failures < 1 && error instanceof ApiError && error.status === 0,
  });
}

export function useResetPassword() {
  const { passwordApi } = useAccount();
  return useMutation({
    ...transient,
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      passwordApi.resetPassword(token, password),
  });
}

/** Replace a temporary password. The session continues on the pair the API returns. */
export function useChangePassword() {
  const { passwordApi, session } = useAccount();
  return useMutation({
    ...transient,
    mutationFn: (passwords: { currentPassword: string; newPassword: string }) =>
      changePassword(session, passwordApi, passwords),
  });
}
