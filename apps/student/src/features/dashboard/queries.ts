import { useQuery } from "@tanstack/react-query";

import { dashboardApi } from "./api";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  studentName: () => [...dashboardKeys.all, "student-name"] as const,
  currentTerm: () => [...dashboardKeys.all, "current-term"] as const,
  announcements: () => [...dashboardKeys.all, "announcements"] as const,
  events: () => [...dashboardKeys.all, "events"] as const,
  recentActivity: () => [...dashboardKeys.all, "recent-activity"] as const,
};

// Each call goes through dashboardApi's property at call time, so a test can stand in for it.

export function useStudentName() {
  return useQuery({
    queryKey: dashboardKeys.studentName(),
    queryFn: () => dashboardApi.studentName(),
  });
}

export function useCurrentTerm() {
  return useQuery({
    queryKey: dashboardKeys.currentTerm(),
    queryFn: () => dashboardApi.currentTerm(),
  });
}

export function useAnnouncements() {
  return useQuery({
    queryKey: dashboardKeys.announcements(),
    queryFn: () => dashboardApi.announcements(),
  });
}

export function useEvents() {
  return useQuery({ queryKey: dashboardKeys.events(), queryFn: () => dashboardApi.events() });
}

export function useRecentActivity() {
  return useQuery({
    queryKey: dashboardKeys.recentActivity(),
    queryFn: () => dashboardApi.recentActivity(),
  });
}
