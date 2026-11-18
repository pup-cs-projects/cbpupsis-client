import { createAdminReportsApi } from "@cbpupsis/shared/reports/admin";
import type { ReportFilters } from "@cbpupsis/shared/reports/admin";
import { apiClient, session } from "../../lib/auth";

const api = createAdminReportsApi(apiClient);
export const reportsApi = {
  enrollment: (filters: ReportFilters, signal?: AbortSignal) =>
    session.authorized((token) => api.enrollment(token, filters, signal)),
  exportEnrollment: (filters: ReportFilters, format: "csv" | "pdf") =>
    session.authorized((token) => api.exportEnrollment(token, filters, format)),
};
