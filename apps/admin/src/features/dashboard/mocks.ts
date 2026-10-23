import type { AdminDashboardData } from "./types";

/** Fictional development-only data. These values are never used in production. */
export const MOCK_DASHBOARD: AdminDashboardData = {
  academicYear: "2025-2026",
  metrics: [
    { label: "Active Students", value: "12,402", detail: "+2.4%" },
    { label: "Active Courses", value: "842" },
    { label: "Active Faculty", value: "568", detail: "+12" },
    { label: "Active Users", value: "2,115" },
    { label: "Pending Grades", value: "42" },
  ],
  activity: [
    {
      id: "login",
      occurredAt: "2026-05-12T06:22:01Z",
      category: "Security",
      event: "Failed login attempt: user_admin_04",
      status: "Warning",
    },
    {
      id: "backup",
      occurredAt: "2026-05-12T06:15:45Z",
      category: "System",
      event: "Automated backup completed (DB_VOL_2)",
      status: "Success",
    },
    {
      id: "export",
      occurredAt: "2026-05-12T05:58:12Z",
      category: "Academic",
      event: "Mass grade export initiated by Faculty #992",
      status: "Info",
    },
    {
      id: "account",
      occurredAt: "2026-05-12T05:42:30Z",
      category: "User",
      event: "New user account created: Dr. Amelia V.",
      status: "Success",
    },
    {
      id: "patch",
      occurredAt: "2026-05-12T05:20:11Z",
      category: "System",
      event: "API Gateway patch applied v2.4.1",
      status: "Ready",
    },
  ],
  events: [
    {
      id: "grades",
      date: "2026-05-15",
      title: "Final Grading Submission",
      details: "All faculty must finalize second semester marks.",
    },
    {
      id: "enrollment",
      date: "2026-05-25",
      title: "Enrollment Preparation",
      details: "Review course offerings and enrollment schedules.",
    },
  ],
};
