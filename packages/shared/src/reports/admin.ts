import type { ApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import * as parse from "../api/parse";

export const REPORT_GROUPS = ["program", "status", "yearLevel", "sex", "section"] as const;
export type ReportGroup = (typeof REPORT_GROUPS)[number];
export interface ReportFilters {
  termId: string;
  groupBy: ReportGroup;
  programCode?: string;
  status?: string;
}
export interface EnrollmentReport {
  rows: { group: string; count: number }[];
  total: number;
}
export function enrollmentReportQuery(filters: ReportFilters, format?: "csv" | "pdf") {
  const query = new URLSearchParams({ termId: filters.termId.trim(), groupBy: filters.groupBy });
  if (filters.programCode?.trim()) query.set("programCode", filters.programCode.trim());
  if (filters.status?.trim()) query.set("status", filters.status.trim());
  if (format) query.set("format", format);
  return query.toString();
}
function report(value: unknown): EnrollmentReport {
  const raw = parse.record(value);
  const rows = parse.array(raw.rows).map((value) => {
    const row = parse.record(value);
    if (typeof row.group !== "string") return parse.invalid();
    const count = parse.nonNegativeInteger(row.count);
    if (!Number.isSafeInteger(count)) return parse.invalid();
    return { group: row.group, count };
  });
  const total = parse.nonNegativeInteger(raw.total);
  if (
    !Number.isSafeInteger(total) ||
    rows.reduce((sum, row) => sum + row.count, 0) !== total ||
    new Set(rows.map((row) => row.group)).size !== rows.length
  )
    return parse.invalid();
  return { rows, total };
}
/** Query values and exports always use the same server-owned scope and displayed filters. */
export function createAdminReportsApi(client: ApiClient) {
  const base = "/admin/reports/enrollment";
  return {
    async enrollment(token: string, filters: ReportFilters, signal?: AbortSignal) {
      return report(
        await client.request(`${base}?${enrollmentReportQuery(filters)}`, {
          method: "GET",
          accessToken: token,
          signal,
        }),
      );
    },
    async exportEnrollment(token: string, filters: ReportFilters, format: "csv" | "pdf") {
      const file = await client.requestBlob(
        `${base}/export?${enrollmentReportQuery(filters, format)}`,
        { method: "GET", accessToken: token },
      );
      if (!file.size || file.type.includes("application/json"))
        throw new ApiError(0, "INVALID_RESPONSE");
      return file;
    },
  };
}
