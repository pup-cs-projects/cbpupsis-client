import type { RequestState } from "../enrollment-requests/types";
export interface AdminDashboardData {
  academicYear: string | null;
  issues?: string[];
  metrics: { label: string; value: string; detail?: string }[];
  activityAvailable?: boolean;
  activity: {
    id: string;
    occurredAt: string;
    category: string;
    event: string;
    status: "Warning" | "Success" | "Info" | "Ready";
    requestState?: RequestState;
  }[];
  events: { id: string; date: string; title: string; details: string }[];
}
