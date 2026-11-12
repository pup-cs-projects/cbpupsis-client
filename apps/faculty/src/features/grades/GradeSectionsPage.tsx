import { gradingErrorMessage } from "@cbpupsis/shared/grades";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { useMe } from "../sign-in/useFacultyAuth";
import { facultyGradingDataSource, type FacultyGradingDataSource } from "./dataSource";
import { gradeButton, gradeCard } from "./gradeStyles";

export function GradeSectionsPage({
  dataSource = facultyGradingDataSource,
}: {
  dataSource?: FacultyGradingDataSource;
}) {
  const me = useMe();
  const sections = useQuery({
    queryKey: ["faculty-grading", me.data?.id, "sections"],
    queryFn: ({ signal }) => dataSource.sections(signal),
    enabled: me.isSuccess,
    retry: false,
  });
  const error = me.error ?? sections.error;
  return (
    <DashboardLayout>
      <div className="space-y-6 px-4 py-8 sm:px-8">
        <header>
          <p className="text-brand-muted text-sm">Academics / Grades</p>
          <h1 className="text-brand-maroon mt-2 text-3xl font-bold">Grade submission</h1>
          <p className="text-brand-muted mt-2 text-sm">
            Select an assigned section to enter, review, and finalize its grades.
          </p>
        </header>
        {error ? (
          <div role="alert" className={gradeCard}>
            <p>{gradingErrorMessage(error)}</p>
            <button
              className={gradeButton + " mt-4"}
              onClick={() => void (me.isError ? me.refetch() : sections.refetch())}
            >
              Retry assigned sections
            </button>
          </div>
        ) : me.isPending || sections.isPending ? (
          <p role="status">Loading assigned sections…</p>
        ) : sections.data?.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {sections.data.map((section) => (
              <article className={gradeCard} key={section.id}>
                <p className="text-brand-muted text-xs font-semibold">{section.termLabel}</p>
                <h2 className="mt-2 text-lg font-bold">
                  {section.courseCode} · {section.courseTitle}
                </h2>
                <p className="text-brand-muted mt-2 text-sm">
                  {section.sectionName} · {section.studentCount} students
                </p>
                <Link
                  to="/sections/$sectionId/grades"
                  params={{ sectionId: section.id }}
                  className={gradeButton + " mt-5"}
                >
                  Enter grades
                  <span className="sr-only">
                    {" "}
                    for {section.courseCode}, {section.sectionName}
                  </span>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p className={gradeCard}>No assigned sections are available for grade submission.</p>
        )}
      </div>
    </DashboardLayout>
  );
}
