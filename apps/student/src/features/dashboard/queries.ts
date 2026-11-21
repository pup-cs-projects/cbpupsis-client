import { useQuery } from "@tanstack/react-query";

import { dashboardApi } from "./api";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  me: () => [...dashboardKeys.all, "me"] as const,
};

// The sidebar on every page reads the name from this same dashboard. Keeping it fresh for a
// minute means moving between pages reuses it instead of asking the API again each time.
const FRESH_FOR_MS = 60_000;

// The call goes through dashboardApi's property at call time, so a test can stand in for it.

/** The whole dashboard (GET /student/me/dashboard), fetched once and shared by the page. */
export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.me(),
    queryFn: () => dashboardApi.get(),
    staleTime: FRESH_FOR_MS,
  });
}

/** Just the student's name, from the same cached dashboard (no second request). */
export function useStudentName() {
  return useQuery({
    queryKey: dashboardKeys.me(),
    queryFn: () => dashboardApi.get(),
    staleTime: FRESH_FOR_MS,
    select: (dashboard) => dashboard.fullName,
  });
}
