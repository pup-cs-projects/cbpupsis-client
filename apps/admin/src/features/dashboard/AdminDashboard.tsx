// Scrollable table regions need keyboard focus at narrow viewport widths.
/* eslint jsx-a11y/no-noninteractive-tabindex: ["error", { "roles": ["region"] }] */
import { NOTICES, type AdminPosition } from "@cbpupsis/shared/auth";
import {
  DashboardEmpty,
  DashboardLoading,
  DashboardMetric,
  DashboardSection,
  ErrorAlert,
  Notice,
} from "@cbpupsis/ui";
import { useSearch } from "@tanstack/react-router";

import "@cbpupsis/account/styles.css";
import { useMe } from "../sign-in/useAdminAuth";
import { DashboardLayout } from "./DashboardLayout";
import { useDashboard } from "./queries";
import { STATE_LABELS } from "../enrollment-requests/reviewRules";

const POSITION_LABELS: Record<AdminPosition, string> = {
  chairperson: "Chairperson",
  dean: "Dean",
  finance: "Finance",
  registrar: "Registrar",
};
const timestamp = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Asia/Manila",
});

export function AdminDashboard() {
  const { notice } = useSearch({ strict: false });
  const me = useMe();
  const dashboard = useDashboard();
  const data = dashboard.data;

  return (
    <DashboardLayout>
      {notice === "password-changed" && <Notice tone="success">{NOTICES.passwordChanged}</Notice>}
      <div className="space-y-7 px-4 py-8 sm:px-8">
        <section
          aria-labelledby="overview-heading"
          className="flex flex-wrap items-center justify-between gap-4"
        >
          <div>
            <h1
              id="overview-heading"
              className="text-brand-maroon text-3xl leading-tight font-bold tracking-tight sm:text-4xl"
            >
              CBPUPSIS Overview
            </h1>
            <p className="text-brand-muted mt-2 text-sm">
              {data?.academicYear
                ? `Academic Year ${data.academicYear}`
                : "Administrative dashboard"}
            </p>
          </div>
          {data && (
            <button
              type="button"
              className="border-brand-maroon text-brand-maroon hover:bg-brand-maroon/5 inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              disabled={dashboard.isFetching}
              onClick={() => void dashboard.refetch()}
            >
              {dashboard.isFetching ? "Refreshing…" : "Refresh overview"}
            </button>
          )}
        </section>
        {me.isPending && (
          <p role="status" className="sr-only">
            Loading your account
          </p>
        )}
        {me.isSuccess && (
          <p className="sr-only">
            Signed in as {me.data.email} ({POSITION_LABELS[me.data.position]}).
          </p>
        )}
        {me.isError && <ErrorAlert error={me.error} onRetry={() => void me.refetch()} />}
        {dashboard.isPending && <DashboardLoading label="Loading admin dashboard" />}
        {dashboard.isError && (
          <ErrorAlert error={dashboard.error} onRetry={() => void dashboard.refetch()} />
        )}
        {data && (
          <>
            {data.issues?.map((issue) => (
              <p key={issue} className="text-brand-muted text-sm">
                {issue}
              </p>
            ))}
            <div className="grid gap-4 sm:grid-cols-2">
              {data.metrics.map((metric) => (
                <DashboardMetric
                  key={metric.label}
                  {...metric}
                  highlight={metric.label === "Pending Grades"}
                />
              ))}
            </div>
            <DashboardSection title="Enrollment request activity">
              {data.activity.length === 0 ? (
                <DashboardEmpty>
                  {data.activityAvailable
                    ? "No enrollment-request activity is available yet."
                    : "Enrollment-request activity is not available to this account."}
                </DashboardEmpty>
              ) : (
                <div
                  role="region"
                  aria-label="Enrollment request records"
                  tabIndex={0}
                  className="border-brand-border/25 focus-visible:outline-brand-maroon overflow-x-auto rounded-xl border bg-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-0"
                >
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">
                      Add/drop, overload, and waiver filings in your scope. Times shown in
                      Asia/Manila.
                    </caption>
                    <thead className="bg-brand-maroon text-xs text-white uppercase">
                      <tr>
                        {["Filed on", "Request", "Activity", "Current status"].map((heading) => (
                          <th key={heading} scope="col" className="px-4 py-4 font-semibold">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-brand-border/25 divide-y">
                      {data.activity.map((item) => (
                        <tr key={item.id}>
                          <td className="text-brand-muted min-w-36 px-4 py-5">
                            <time dateTime={item.occurredAt}>
                              {timestamp.format(new Date(item.occurredAt))}
                            </time>
                          </td>
                          <th scope="row" className="px-4 py-5 text-xs font-bold uppercase">
                            {item.category}
                          </th>
                          <td className="min-w-48 px-4 py-5">{item.event}</td>
                          <td className="px-4 py-5">
                            <span
                              className={`inline-block rounded-md border px-2.5 py-1 text-xs font-semibold ${item.status === "Warning" ? "border-brand-maroon text-brand-maroon" : item.status === "Success" ? "border-brand-success text-brand-success" : "border-brand-border text-brand-help"}`}
                            >
                              {item.requestState ? STATE_LABELS[item.requestState] : item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DashboardSection>

            <p className="text-brand-muted text-sm">
              Activity includes add/drop, overload, and waiver requests in your scope. Refresh the
              overview to view the latest updates.
            </p>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
