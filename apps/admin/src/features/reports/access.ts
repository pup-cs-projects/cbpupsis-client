import type { EnrollmentReportFilters } from "@cbpupsis/shared/reports";

/**
 * Report tabs and the positions that hold each tab's permission. `/admin/me` returns the
 * position, not the permission list, so this mirrors the API's ADMIN_POSITION_POLICIES
 * (iam/constants.py): EnrollmentReportReader goes to Chair, Dean, and Registrar. Hiding a tab is
 * UX only; the API answers anyone else with 403 AUTH_INSUFFICIENT_ROLE.
 */
export const REPORT_TABS = [
  {
    id: "enrollment",
    label: "Enrollment",
    permission: "ReadEnrollmentReport",
    positions: ["chairperson", "dean", "registrar"],
  },
] as const;

export type ReportTab = (typeof REPORT_TABS)[number];

export function reportTabsFor(position: string | undefined): ReportTab[] {
  return REPORT_TABS.filter((tab) => (tab.positions as readonly string[]).includes(position ?? ""));
}

/** Whose students the API counts for this position (AC-RPT-001.4). */
export function scopeLabel(position: string | undefined): string {
  if (position === "chairperson") return "Students in your department";
  if (position === "dean") return "Students in your college";
  return "All students";
}

/** The query key factory for this feature. */
export const reportKeys = {
  all: ["reports"] as const,
  terms: (owner: string | undefined) => [...reportKeys.all, "terms", owner] as const,
  enrollment: (owner: string | undefined, filters: EnrollmentReportFilters | null) =>
    [...reportKeys.all, "enrollment", owner, filters] as const,
};
