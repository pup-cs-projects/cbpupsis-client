import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";

/**
 * The enrollment report behind the admin reports page (US-RPT-001, API #198).
 * Contract: `GET /admin/reports/enrollment` and `/export` in the API's docs/openapi.json.
 * The API scopes every count to the caller (Chair: department, Dean: college, Registrar: all)
 * and returns counts only, never names or student numbers.
 */

/** The groupings the API accepts for `groupBy`. */
export const ENROLLMENT_GROUP_BY = ["program", "status", "yearLevel", "sex", "section"] as const;
export type EnrollmentGroupBy = (typeof ENROLLMENT_GROUP_BY)[number];

export type EnrollmentExportFormat = "csv" | "pdf";

export interface EnrollmentReportFilters {
  /** Academic term UUID. The API requires it. */
  termId: string;
  /** Program code, such as `BSCS`. Matched without regard to case. */
  programCode?: string;
  /** Term enrollment status, such as `enrolled`. Matched without regard to case. */
  status?: string;
  groupBy: EnrollmentGroupBy;
}

export interface EnrollmentReportRow {
  group: string;
  count: number;
}

export interface EnrollmentReport {
  rows: EnrollmentReportRow[];
  total: number;
}

function parseRow(value: unknown): EnrollmentReportRow {
  const raw = parse.record(value);
  if (typeof raw.group !== "string") parse.invalid();
  return { group: raw.group, count: parse.nonNegativeInteger(raw.count) };
}

export function parseEnrollmentReport(value: unknown): EnrollmentReport {
  const raw = parse.record(value);
  return {
    rows: parse.array(raw.rows).map(parseRow),
    total: parse.nonNegativeInteger(raw.total),
  };
}

/** The query string both endpoints share. Empty optional filters are left out. */
export function enrollmentReportQuery(
  filters: EnrollmentReportFilters,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams({ termId: filters.termId, groupBy: filters.groupBy });
  const program = filters.programCode?.trim();
  const status = filters.status?.trim();
  if (program) params.set("programCode", program);
  if (status) params.set("status", status);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return params.toString();
}

export function createAdminReportsApi(client: ApiClient) {
  return {
    async enrollment(
      accessToken: string,
      filters: EnrollmentReportFilters,
      signal?: AbortSignal,
    ): Promise<EnrollmentReport> {
      const path = `/admin/reports/enrollment?${enrollmentReportQuery(filters)}`;
      return parseEnrollmentReport(
        await client.request(path, { method: "GET", accessToken, signal }),
      );
    },

    /** The same numbers as `enrollment`, as a CSV or PDF file. */
    async exportEnrollment(
      accessToken: string,
      filters: EnrollmentReportFilters,
      format: EnrollmentExportFormat,
    ): Promise<Blob> {
      const path = `/admin/reports/enrollment/export?${enrollmentReportQuery(filters, { format })}`;
      return client.requestBlob(path, { accessToken, timeoutMs: 60_000 });
    },
  };
}

export type AdminReportsApi = ReturnType<typeof createAdminReportsApi>;
