import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createApiClient } from "@cbpupsis/shared/api";
import {
  createStudentWaiverApi,
  type StudentWaiverRead,
  type WaiverFile,
  type WaiverFiled,
} from "@cbpupsis/shared/enrollment";

import { session } from "../../lib/auth";

// Its own client on the same base URL as lib/auth, so this story does not touch that shared
// file while the enrollment page (#41) and add/drop (#44) also extend it. The client keeps no
// state; tokens come from the portal's one session.
const api = createStudentWaiverApi(
  createApiClient(import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1"),
);

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
