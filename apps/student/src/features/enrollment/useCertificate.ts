import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { certificateApi as api, session } from "../../lib/auth";

export const certificateKeys = {
  all: ["certificate"] as const,
  byTerm: (termId: string) => [...certificateKeys.all, termId] as const,
};

export const certificateApi = {
  async get(termId: string) {
    return session.authorized((token) => api.get(token, termId));
  },

  async issue(termId: string): Promise<void> {
    return session.authorized((token) => api.issue(token, termId));
  },
};

/** The issued Certificate of Registration for `termId`, or `null` once it is clear none exists
 * yet (COR_NOT_ENROLLED, COR_ENROLLMENT_NOT_FINAL): a state the page shows, never an error. */
export function useCertificate(termId: string | undefined) {
  return useQuery({
    queryKey: certificateKeys.byTerm(termId ?? ""),
    queryFn: () => certificateApi.get(termId as string),
    enabled: Boolean(termId),
  });
}

/** Issues the certificate, then refetches so the page shows the result it just created. */
export function useIssueCertificate(termId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => certificateApi.issue(termId as string),
    onSuccess: () => {
      if (termId) void queryClient.invalidateQueries({ queryKey: certificateKeys.byTerm(termId) });
    },
  });
}
