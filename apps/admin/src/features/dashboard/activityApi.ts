import { ApiError } from "@cbpupsis/shared/api";
import type { AdminPosition } from "@cbpupsis/shared/auth";
import { enrollmentReviewDataSource } from "../enrollment-requests/dataSource";
import type { RequestKind } from "../enrollment-requests/types";
import type { AdminDashboardData } from "./types";

const categories: Record<RequestKind, string> = {
  "add-drop": "Add and drop",
  overload: "Overload",
  waivers: "Waiver",
};
export async function loadEnrollmentActivity(position: AdminPosition, signal: AbortSignal) {
  if (position === "finance")
    return {
      items: [] as AdminDashboardData["activity"],
      issues: [] as string[],
      available: false,
    };
  const kinds = ["add-drop", "overload", "waivers"] as const;
  const replies = await Promise.allSettled(
    kinds.map((kind) => enrollmentReviewDataSource.list(kind, signal)),
  );
  signal.throwIfAborted();
  const items: AdminDashboardData["activity"] = [];
  const issues: string[] = [];
  replies.forEach((reply, index) => {
    if (reply.status === "rejected") {
      if (reply.reason instanceof ApiError && reply.reason.status === 401) throw reply.reason;
      issues.push(`${categories[kinds[index]]} activity could not be loaded. Refresh to retry.`);
      return;
    }
    for (const request of reply.value.items)
      items.push({
        id: `${request.kind}:${request.id}`,
        occurredAt: request.filedAt,
        category: categories[request.kind],
        event: `${request.student.name || request.student.number || request.student.id} filed ${request.kind === "add-drop" ? "an add/drop" : request.kind === "overload" ? "an overload" : "a waiver"} request.`,
        status:
          request.state === "APPROVED"
            ? "Success"
            : request.state === "REJECTED"
              ? "Warning"
              : "Info",
        requestState: request.state,
      });
  });
  items.sort(
    (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.id.localeCompare(b.id),
  );
  return {
    items: items.slice(0, 20),
    issues,
    available: replies.some((reply) => reply.status === "fulfilled"),
  };
}
