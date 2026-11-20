import { NOTICES } from "@cbpupsis/shared/auth";
import type { FacultyDashboardSection } from "@cbpupsis/shared/dashboard";
import {
  DashboardEmpty,
  DashboardIcon,
  DashboardLoading,
  DashboardMetric,
  DashboardSection,
  ErrorAlert,
  Notice,
} from "@cbpupsis/ui";
import { Link, useSearch } from "@tanstack/react-router";
import "@cbpupsis/account/styles.css";
import { gradeButton, gradeDate } from "../grades/gradeStyles";
import { useMe } from "../sign-in/useFacultyAuth";
import { DashboardLayout } from "./DashboardLayout";
import { useDashboard, useProfile } from "./queries";

function SectionLinks({ section }: { section: FacultyDashboardSection }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        to="/sections/$sectionId/roster"
        params={{ sectionId: section.id }}
        className={gradeButton}
        aria-label={`Open roster for ${section.sectionName}`}
      >
        Roster
      </Link>
      <Link
        to="/sections/$sectionId/grades"
        params={{ sectionId: section.id }}
        className={gradeButton}
        aria-label={`${section.gradeState === "FINAL" ? "View" : "Enter"} grades for ${section.sectionName}`}
      >
        {section.gradeState === "FINAL" ? "View grades" : "Enter grades"}
      </Link>
    </div>
  );
}
const gradeStatus = (section: FacultyDashboardSection) =>
  section.gradeState === "FINAL"
    ? "Final"
    : section.gradeState === "DRAFT"
      ? "Draft"
      : "Unavailable";
export function FacultyDashboard() {
  const { notice } = useSearch({ strict: false });
  const me = useMe();
  const profile = useProfile(me.isSuccess);
  const dashboard = useDashboard();
  const data = dashboard.isError ? undefined : dashboard.data;
  const name = profile.data?.full_name?.trim() || profile.data?.display_name?.trim();
  const deadlines =
    data?.sections
      .filter((s) => s.gradeState === "DRAFT" && s.deadline && s.studentCount)
      .sort((a, b) => Date.parse(a.deadline!) - Date.parse(b.deadline!))
      .slice(0, 5) ?? [];
  return (
    <DashboardLayout>
      {notice === "password-changed" && <Notice tone="success">{NOTICES.passwordChanged}</Notice>}
      <div className="space-y-7 px-4 py-8 sm:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl leading-tight font-bold tracking-tight sm:text-4xl">
              {name ? (
                <>
                  Welcome, <span className="text-brand-maroon">{name}</span>
                </>
              ) : (
                "Welcome to your Faculty dashboard"
              )}
            </h1>
            <p className="text-brand-muted mt-2 text-sm">
              Review your assigned sections, grade submissions, and recent notifications.
            </p>
          </div>
          <button
            className={gradeButton}
            disabled={!me.isSuccess || dashboard.isFetching}
            onClick={() => void dashboard.refetch()}
          >
            {dashboard.isFetching ? "Refreshing dashboard…" : "Refresh dashboard"}
          </button>
        </header>
        {me.isSuccess && <p className="sr-only">Signed in as {me.data.email}</p>}
        {me.isError && <ErrorAlert error={me.error} onRetry={() => void me.refetch()} />}
        {!me.isError && dashboard.isPending && (
          <DashboardLoading label="Loading faculty dashboard" />
        )}
        {dashboard.isError && (
          <ErrorAlert error={dashboard.error} onRetry={() => void dashboard.refetch()} />
        )}
        {data && (
          <>
            {!!data.issues.length && (
              <div
                className="border-brand-border/25 rounded-xl border bg-white p-5 text-sm"
                role="alert"
              >
                <p className="font-semibold">Some dashboard information is unavailable.</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {data.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid gap-4 lg:grid-cols-3">
              <DashboardMetric
                label="Assigned sections"
                value={String(data.sections.length)}
                icon={<DashboardIcon name="book" />}
              />
              <DashboardMetric
                label="Students taught"
                value={data.studentsTaught?.toLocaleString("en-PH") ?? "Unavailable"}
                detail="Unique students across assigned grade sheets"
                icon={<DashboardIcon name="users" />}
              />
              <DashboardMetric
                label="Sections awaiting grades"
                value={data.pendingSections?.toLocaleString("en-PH") ?? "Unavailable"}
                detail="Draft sections with enrolled students"
                icon={<DashboardIcon name="briefcase" />}
              />
            </div>
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
              <DashboardSection
                title="Assigned sections"
                action={
                  <Link
                    to="/sections"
                    className="text-brand-maroon inline-flex min-h-11 items-center text-sm font-semibold underline"
                  >
                    View all sections
                  </Link>
                }
              >
                {!data.sections.length ? (
                  <DashboardEmpty>No sections are assigned to you yet.</DashboardEmpty>
                ) : (
                  <>
                    <div className="border-brand-border/25 hidden overflow-x-auto rounded-xl border bg-white shadow-sm md:block">
                      <table className="w-full text-left text-sm">
                        <caption className="sr-only">
                          Assigned sections and grade submission status
                        </caption>
                        <thead className="bg-brand-maroon text-xs text-white uppercase">
                          <tr>
                            {["Course", "Section", "Grades", "Actions"].map((label) => (
                              <th key={label} scope="col" className="px-4 py-4 font-semibold">
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-brand-border/25 divide-y">
                          {data.sections.map((section) => (
                            <tr key={section.id}>
                              <th scope="row" className="px-4 py-5">
                                <span className="text-brand-maroon block font-semibold">
                                  {section.courseCode ?? "Course details unavailable"}
                                </span>
                                {section.courseTitle && (
                                  <span className="mt-1 block text-xs font-normal">
                                    {section.courseTitle}
                                  </span>
                                )}
                              </th>
                              <td className="px-4 py-5">{section.sectionName}</td>
                              <td className="px-4 py-5">{gradeStatus(section)}</td>
                              <td className="px-4 py-5">
                                <SectionLinks section={section} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <ul className="space-y-4 md:hidden">
                      {data.sections.map((section) => (
                        <li
                          key={section.id}
                          className="border-brand-border/25 rounded-xl border bg-white p-5 shadow-sm"
                        >
                          <h3 className="text-brand-maroon font-bold">
                            {section.courseCode ?? section.sectionName}
                          </h3>
                          {section.courseTitle && (
                            <p className="mt-1 text-sm">{section.courseTitle}</p>
                          )}
                          <p className="text-brand-muted mt-2 text-sm">
                            {section.sectionName} · Grades: {gradeStatus(section)}
                          </p>
                          <div className="mt-4">
                            <SectionLinks section={section} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </DashboardSection>
              <div className="min-w-0 space-y-6">
                <DashboardSection
                  title="Grade deadlines"
                  icon={<DashboardIcon name="calendar" />}
                  action={
                    <Link
                      to="/grades"
                      className="text-brand-maroon inline-flex min-h-11 items-center text-sm font-semibold underline"
                    >
                      View grades
                    </Link>
                  }
                >
                  {deadlines.length ? (
                    <ul className="border-brand-border/25 divide-brand-border/25 divide-y rounded-xl border bg-white px-5 shadow-sm">
                      {deadlines.map((section) => (
                        <li key={section.id} className="py-4">
                          <Link
                            to="/sections/$sectionId/grades"
                            params={{ sectionId: section.id }}
                            className="text-brand-maroon inline-flex min-h-11 items-center font-semibold underline"
                          >
                            {section.courseCode ? `${section.courseCode} · ` : ""}
                            {section.sectionName}
                          </Link>
                          <p className="text-brand-muted mt-1 text-sm">
                            <time dateTime={section.deadline!}>{gradeDate(section.deadline)}</time>
                          </p>
                          <p className="mt-2 text-xs font-semibold">
                            {section.deadlinePassed ? "Deadline passed" : "Submission open"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <DashboardEmpty>
                      {data.pendingSections === null
                        ? "Grade deadlines could not be confirmed for all sections."
                        : "No grade submissions are pending."}
                    </DashboardEmpty>
                  )}
                </DashboardSection>
                <div id="faculty-notifications">
                  <DashboardSection
                    title="Recent notifications"
                    icon={<DashboardIcon name="announcement" />}
                    action={
                      <Link
                        to="/profile"
                        hash="notification-heading"
                        className="text-brand-maroon inline-flex min-h-11 items-center text-sm font-semibold underline"
                      >
                        Preferences
                      </Link>
                    }
                  >
                    {data.notifications === null ? (
                      <DashboardEmpty>
                        Notifications are unavailable. Refresh the dashboard to retry.
                      </DashboardEmpty>
                    ) : !data.notifications.length ? (
                      <DashboardEmpty>No notifications yet.</DashboardEmpty>
                    ) : (
                      <ul className="border-brand-border/25 divide-brand-border/25 divide-y rounded-xl border bg-white px-5 shadow-sm">
                        {data.notifications.map((item) => (
                          <li key={item.id} className="py-4">
                            <p className="text-brand-muted text-xs">
                              {item.read ? "Read" : "Unread"} ·{" "}
                              <time dateTime={item.createdAt}>{gradeDate(item.createdAt)}</time>
                            </p>
                            <h3 className="mt-2 text-sm font-semibold">{item.title}</h3>
                            {item.body && (
                              <p className="text-brand-muted mt-2 text-sm leading-relaxed break-words">
                                {item.body}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </DashboardSection>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
