import { useQuery } from "@tanstack/react-query";

import { profileApi, session } from "../../lib/auth";
import { dashboardApi } from "./api";
import { useMe } from "../sign-in/useFacultyAuth";

export const dashboardKeys = {
  all: ["faculty-dashboard"] as const,
  profile: () => [...dashboardKeys.all, "profile"] as const,
  overview: () => [...dashboardKeys.all, "overview"] as const,
};

export function useDashboard() {
  const me = useMe();
  return useQuery({
    queryKey: [...dashboardKeys.overview(), me.data?.id],
    queryFn: ({ signal }) => dashboardApi.overview(signal),
    enabled: me.isSuccess,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useProfile(enabled: boolean) {
  const me = useMe();
  return useQuery({
    queryKey: [...dashboardKeys.profile(), me.data?.id],
    queryFn: () => session.authorized(profileApi.me),
    enabled,
    retry: false,
  });
}
