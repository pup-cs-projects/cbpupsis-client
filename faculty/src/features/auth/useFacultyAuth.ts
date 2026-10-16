import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../../lib/auth-api";

export const facultySessionKey = ["faculty-auth", "session"] as const;
export function useFacultyAuth() {
  const queryClient = useQueryClient();
  const options = { gcTime: 0, retry: false };
  const login = useMutation({ ...options, mutationFn: authApi.login });
  const enrollment = useMutation({ ...options, mutationFn: authApi.enroll });
  const confirmation = useMutation({
    ...options,
    mutationFn: ({ token, code }: { token: string; code: string }) =>
      authApi.confirmEnrollment(token, code),
  });
  const verification = useMutation({
    ...options,
    mutationFn: ({ token, code }: { token: string; code: string }) => authApi.verify(token, code),
    onSuccess: (result) => queryClient.setQueryData(facultySessionKey, result),
  });
  return { login, enrollment, confirmation, verification };
}
