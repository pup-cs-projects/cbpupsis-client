import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { StudentWaiverRead, WaiverFile, WaiverFiled } from "@cbpupsis/shared/enrollment";

import { session, studentWaiverApi as api } from "../../lib/auth";

/** The waiver calls, through the portal's session. */
export const waiverApi = {
  async list(): Promise<StudentWaiverRead[]> {
    return session.authorized((token) => api.list(token));
  },

  async file(body: WaiverFile): Promise<WaiverFiled> {
    return session.authorized((token) => api.file(token, body));
  },
};

export const waiverKeys = {
  all: ["waivers"] as const,
};

// Each call goes through waiverApi's property at call time, so a test can stand in for it.

/** The student's own waivers, shared by every blocked section on the page. */
export function useWaivers() {
  return useQuery({ queryKey: waiverKeys.all, queryFn: () => waiverApi.list() });
}

export function useFileWaiver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: WaiverFile) => waiverApi.file(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: waiverKeys.all }),
  });
}
