import { ApiError } from "@cbpupsis/shared/api";
import type { AdminPosition } from "@cbpupsis/shared/auth";
import { adminOperationsApi } from "../../lib/adminApi";
import { loadEnrollmentActivity } from "./activityApi";
import type { AdminDashboardData } from "./types";

export const dashboardApi = {
  async overview(position: AdminPosition, signal: AbortSignal): Promise<AdminDashboardData> {
    const [courses, unread, activity] = await Promise.allSettled([
      position === "finance" ? Promise.resolve(null) : adminOperationsApi.courses("", 0, signal, 1),
      adminOperationsApi.unread(signal),
      loadEnrollmentActivity(position, signal),
    ]);
    signal.throwIfAborted();
    for (const reply of [courses, unread, activity])
      if (
        reply.status === "rejected" &&
        reply.reason instanceof ApiError &&
        reply.reason.status === 401
      )
        throw reply.reason;
    const metrics: AdminDashboardData["metrics"] = [];
    const issues: string[] = [];
    if (courses.status === "fulfilled" && courses.value)
      metrics.push({
        label: "Courses in your scope",
        value: String(courses.value.total),
        detail: "Includes active and inactive courses",
      });
    else if (courses.status === "rejected")
      issues.push("Course totals could not be loaded. Refresh to retry.");
    if (unread.status === "fulfilled")
      metrics.push({
        label: "Unread notifications",
        value: String(unread.value),
        detail: "Your account only",
      });
    else issues.push("Unread notifications could not be loaded. Refresh to retry.");
    if (activity.status === "fulfilled") issues.push(...activity.value.issues);
    else issues.push("Enrollment request activity could not be loaded. Refresh to retry.");
    return {
      academicYear: null,
      metrics,
      issues,
      events: [],
      activity: activity.status === "fulfilled" ? activity.value.items : [],
      activityAvailable: activity.status === "fulfilled" && activity.value.available,
    };
  },
};
