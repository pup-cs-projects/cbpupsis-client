import { ApiError } from "@cbpupsis/shared/api";
import type { AdminPosition } from "@cbpupsis/shared/auth";
import { apiClient, session } from "../../lib/auth";
import { loadEnrollmentActivity } from "./activityApi";
import type { AdminDashboardData } from "./types";

/** A non-negative integer field from an API body, or an INVALID_RESPONSE error. */
function count(body: unknown, key: string): number {
  const value =
    body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
    throw new ApiError(0, "INVALID_RESPONSE");
  return value;
}

const read = (path: string, signal: AbortSignal) =>
  session.authorized((token) =>
    apiClient.request(path, { method: "GET", accessToken: token, signal }),
  );

export const dashboardApi = {
  /** Composes the overview from scoped, published endpoints; no aggregate route is assumed. */
  async overview(position: AdminPosition, signal: AbortSignal): Promise<AdminDashboardData> {
    const [courses, unread, activity] = await Promise.allSettled([
      position === "finance"
        ? Promise.resolve(null)
        : read("/admin/catalog/courses?limit=1&offset=0", signal).then((body) =>
            count(body, "total"),
          ),
      read("/notifications/unread-count", signal).then((body) => count(body, "unread")),
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
    if (courses.status === "fulfilled" && courses.value !== null)
      metrics.push({
        label: "Courses in your scope",
        value: courses.value.toLocaleString("en-PH"),
        detail: "Includes active and inactive courses",
      });
    else if (courses.status === "rejected")
      issues.push("Course totals could not be loaded. Refresh to retry.");
    if (unread.status === "fulfilled")
      metrics.push({
        label: "Unread notifications",
        value: unread.value.toLocaleString("en-PH"),
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
