import {
  createAdminReportsApi,
  type AdminReportsApi,
  type EnrollmentExportFormat,
  type EnrollmentReportFilters,
} from "@cbpupsis/shared/reports";
import type { AdminEnrollmentApi } from "@cbpupsis/shared/enrollment";
import type { Session } from "@cbpupsis/shared/auth";
import { apiClient, enrollmentApi, session } from "../../lib/auth";

export interface TermOption {
  id: string;
  label: string;
}

/**
 * The API has no admin term list yet, so the term picker offers the terms the admin's own
 * add/drop queue names (each carries `academicTermId` and its label). A term missing there
 * can still be typed in by its id.
 */
export function termsFrom(items: { academicTermId: string; term: string }[]): TermOption[] {
  const seen = new Map<string, string>();
  for (const item of items) {
    if (!seen.has(item.academicTermId)) seen.set(item.academicTermId, item.term || "Term");
  }
  return [...seen]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => (a.label < b.label ? 1 : -1));
}

export function createReportsDataSource(
  reports: AdminReportsApi,
  enrollment: Pick<AdminEnrollmentApi, "listAddDrop">,
  auth: Pick<Session, "authorized">,
) {
  return {
    enrollment: (filters: EnrollmentReportFilters, signal?: AbortSignal) =>
      auth.authorized((token) => reports.enrollment(token, filters, signal)),
    exportEnrollment: (filters: EnrollmentReportFilters, format: EnrollmentExportFormat) =>
      auth.authorized((token) => reports.exportEnrollment(token, filters, format)),
    terms: async (signal?: AbortSignal) =>
      termsFrom(await auth.authorized((token) => enrollment.listAddDrop(token, signal))),
  };
}

export type ReportsDataSource = ReturnType<typeof createReportsDataSource>;

export const reportsDataSource = createReportsDataSource(
  createAdminReportsApi(apiClient),
  enrollmentApi,
  session,
);
