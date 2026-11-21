export interface AdminDashboardData {
  academicYear: string | null;
  metrics: { label: string; value: string; detail?: string }[];
  activity: {
    id: string;
    occurredAt: string;
    category: string;
    event: string;
    status: "Warning" | "Success" | "Info" | "Ready";
  }[];
  events: { id: string; date: string; title: string; details: string }[];
}
