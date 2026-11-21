import { useQuery } from "@tanstack/react-query";

import { profileApi, session } from "../../lib/auth";
import { dashboardApi } from "./api";
import { useMe } from "../sign-in/useAdminAuth";

export const dashboardKeys = {
  all: ["admin-dashboard"] as const,
  profile: () => [...dashboardKeys.all, "profile"] as const,
  overview: () => [...dashboardKeys.all, "overview"] as const,
};

export function useDashboard() {
  const me = useMe();
  return useQuery({
    queryKey: [
      ...dashboardKeys.overview(),
      me.data?.id,
      me.data?.position,
      me.data?.departmentId,
      me.data?.collegeId,
    ],
    queryFn: ({ signal }) => dashboardApi.overview(me.data!.position, signal),
    enabled: me.isSuccess && session.isSignedIn(),
    retry: false,
    refetchOnWindowFocus: true,
  });
}

export function useProfile(enabled: boolean) {
  return useQuery({
    queryKey: dashboardKeys.profile(),
    queryFn: () => session.authorized(profileApi.me),
    enabled,
    retry: false,
  });
}
