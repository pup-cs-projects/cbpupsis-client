import { useQuery } from "@tanstack/react-query";

import { profileApi, session } from "../../lib/auth";
import { dashboardApi } from "./api";

export const dashboardKeys = {
  all: ["faculty-dashboard"] as const,
  profile: () => [...dashboardKeys.all, "profile"] as const,
  overview: () => [...dashboardKeys.all, "overview"] as const,
};

export function useDashboard() {
  return useQuery({ queryKey: dashboardKeys.overview(), queryFn: () => dashboardApi.overview() });
}

export function useProfile(enabled: boolean) {
  return useQuery({
    queryKey: dashboardKeys.profile(),
    queryFn: () => session.authorized(profileApi.me),
    enabled,
    retry: false,
  });
}
