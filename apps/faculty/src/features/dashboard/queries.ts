import { useQuery, useQueryClient } from "@tanstack/react-query";

import { profileApi, session } from "../../lib/auth";
import { rememberCourseLabel } from "../sections/courseLabels";
import { dashboardApi } from "./api";
import { useMe } from "../sign-in/useFacultyAuth";

export const dashboardKeys = {
  all: ["faculty-dashboard"] as const,
  profile: () => [...dashboardKeys.all, "profile"] as const,
  overview: () => [...dashboardKeys.all, "overview"] as const,
};

export function useDashboard() {
  const me = useMe();
  const client = useQueryClient();
  const ownerId = me.data?.id;
  return useQuery({
    queryKey: [...dashboardKeys.overview(), ownerId],
    queryFn: async ({ signal }) => {
      const overview = await dashboardApi.overview(signal);
      // The overview already read every grade sheet; let section cards reuse the course labels.
      for (const section of overview.sections)
        rememberCourseLabel(client, ownerId, section.id, section.courseCode, section.courseTitle);
      return overview;
    },
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
