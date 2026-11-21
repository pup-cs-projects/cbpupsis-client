import { NOTICES, type AdminPosition } from "@cbpupsis/shared/auth";
import {
  DashboardCalendar,
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
        </section>
        {me.isError && <ErrorAlert error={me.error} onRetry={() => void me.refetch()} />}
        {dashboard.isPending && <DashboardLoading label="Loading admin dashboard" />}
        {dashboard.isError && (
          <ErrorAlert error={dashboard.error} onRetry={() => void dashboard.refetch()} />
        )}
        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {(data.metrics.length
                ? data.metrics
                : [
                    "Active Students",
                    "Active Courses",
                    "Active Faculty",
                    "Active Users",
                    "Pending Grades",
                  ].map((label) => ({ label, value: "Unavailable", detail: undefined }))
              ).map((metric) => (
                <DashboardMetric
                  key={metric.label}
                  {...metric}
                  highlight={metric.label === "Pending Grades"}
                />
              ))}
            </div>
            <DashboardSection title="Security and Activity Feed">
              {data.activity.length === 0 ? (
                <DashboardEmpty>No recent activity available.</DashboardEmpty>
              ) : (
                <div className="border-brand-border/25 overflow-x-auto rounded-xl border bg-white shadow-sm">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">
                      Security and system activity. Times shown in Asia/Manila.
                    </caption>
                    <thead className="bg-brand-maroon text-xs text-white uppercase">
                      <tr>
                        {["Timestamp", "Category", "Event", "Status"].map((heading) => (
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
                              className={`inline-block rounded border px-2 py-1 text-xs font-bold uppercase ${item.status === "Warning" ? "border-brand-maroon text-brand-maroon" : item.status === "Success" ? "border-brand-success text-brand-success" : "border-brand-border text-brand-help"}`}
                            >
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DashboardSection>

            <DashboardCalendar events={data.events} />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
