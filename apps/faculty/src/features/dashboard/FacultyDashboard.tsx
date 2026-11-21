import { NOTICES } from "@cbpupsis/shared/auth";
import {
  DashboardAnnouncements,
  DashboardCalendar,
  DashboardEmpty,
  DashboardIcon,
  DashboardLoading,
  DashboardMetric,
  DashboardSection,
  ErrorAlert,
  Notice,
} from "@cbpupsis/ui";
import { useSearch } from "@tanstack/react-router";

import "@cbpupsis/account/styles.css";
import { useMe } from "../sign-in/useFacultyAuth";
import { DashboardLayout } from "./DashboardLayout";
import { useDashboard } from "./queries";

export function FacultyDashboard() {
  const { notice } = useSearch({ strict: false });
  const me = useMe();
  const dashboard = useDashboard();
  const data = dashboard.data;

  return (
    <DashboardLayout>
      {notice === "password-changed" && <Notice tone="success">{NOTICES.passwordChanged}</Notice>}
      <div className="space-y-7 px-4 py-8 sm:px-8">
        <section aria-labelledby="welcome-heading">
          <h1
            id="welcome-heading"
            className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl"
          >
            Welcome
            {data?.fullName ? (
              <>
                , Prof. <span className="text-brand-maroon">{data.fullName}</span>
              </>
            ) : (
              " to your Faculty dashboard"
            )}
          </h1>
          <p className="text-brand-muted mt-2 text-sm">
            Here is what's happening with your academic dashboard today.
          </p>
          {me.isPending && (
            <p role="status" className="sr-only">
              Loading your account
            </p>
          )}
          {me.isSuccess && <p className="sr-only">Signed in as {me.data.email}</p>}
        </section>
        {me.isError && <ErrorAlert error={me.error} onRetry={() => void me.refetch()} />}
        {dashboard.isPending && <DashboardLoading label="Loading faculty dashboard" />}
        {dashboard.isError && (
          <ErrorAlert error={dashboard.error} onRetry={() => void dashboard.refetch()} />
        )}
        {data && (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <DashboardMetric
                label="Assigned Courses"
                value={data.courses.length ? String(data.courses.length) : "Unavailable"}
                icon={<DashboardIcon name="book" />}
              />
              <DashboardMetric
                label="Students Taught"
                value={data.studentsTaught?.toLocaleString("en-PH") ?? "Unavailable"}
                icon={<DashboardIcon name="users" />}
              />
              <DashboardMetric
                label="Pending Grades"
                value={
                  data.courses.length
                    ? String(
                        data.courses.filter((course) => course.status === "grade-submission")
                          .length,
                      )
                    : "Unavailable"
                }
                icon={<DashboardIcon name="calendar" />}
              />
            </div>
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
              <DashboardSection title={`Assigned Courses${data.term ? ` (${data.term})` : ""}`}>
                {data.courses.length === 0 ? (
                  <DashboardEmpty>No assigned courses available yet.</DashboardEmpty>
                ) : (
                  <div className="border-brand-border/25 overflow-x-auto rounded-xl border bg-white shadow-sm">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">
                        Assigned courses with sections, schedules, and grading status
                      </caption>
                      <thead className="bg-brand-maroon text-xs text-white uppercase">
                        <tr>
                          {["Code", "Title", "Section", "Schedule", "Status"].map((heading) => (
                            <th key={heading} scope="col" className="px-4 py-4 font-semibold">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-brand-border/25 divide-y">
                        {data.courses.map((course) => (
                          <tr key={`${course.code}-${course.section}`}>
                            <td className="px-4 py-5 text-xs">{course.code}</td>
                            <th scope="row" className="min-w-36 px-4 py-5 font-semibold">
                              {course.title}
                            </th>
                            <td className="px-4 py-5">{course.section}</td>
                            <td className="min-w-32 px-4 py-5">{course.schedule}</td>
                            <td className="px-4 py-5">
                              <span
                                className={`inline-block rounded px-2 py-1 text-xs font-semibold uppercase ${course.status === "ongoing" ? "bg-brand-skeleton/20 text-brand-help" : "bg-brand-maroon/10 text-brand-maroon"}`}
                              >
                                {course.status === "ongoing" ? "Ongoing" : "Grade submission"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </DashboardSection>
              <div className="space-y-6">
                <DashboardCalendar events={data.events} />
                <DashboardAnnouncements announcements={data.announcements} />
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
