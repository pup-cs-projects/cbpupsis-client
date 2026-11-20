import { errorMessage } from "@cbpupsis/shared/api";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { facultySectionsApi, session } from "../../lib/auth";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { gradeButton, gradeCard } from "../grades/gradeStyles";
import { useMe } from "../sign-in/useFacultyAuth";
import { CourseSectionHeading } from "./CourseSectionHeading";

export function SectionsPage() {
  const me = useMe();
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["faculty-sections", me.data?.id, offset],
    queryFn: ({ signal }) =>
      session.authorized((token) => facultySectionsApi.sections(token, offset, signal)),
    enabled: me.isSuccess,
    retry: false,
  });
  const error = me.error ?? query.error;
  return (
    <DashboardLayout>
      <div className="space-y-6 px-4 py-8 sm:px-8">
        <header>
          <p className="text-brand-muted text-sm">Academics / Courses</p>
          <h1 className="text-brand-maroon mt-2 text-3xl font-bold">Assigned sections</h1>
          <p className="text-brand-muted mt-2">
            View your assigned courses and sections. Open a class roster or enter grades.
          </p>
        </header>
        {error ? (
          <div className={gradeCard} role="alert">
            <p>{errorMessage(error)}</p>
            <button
              className={gradeButton + " mt-4"}
              onClick={() => void (me.isError ? me.refetch() : query.refetch())}
            >
              Retry sections
            </button>
          </div>
        ) : !query.data ? (
          <p role="status">Loading assigned sections…</p>
        ) : !query.data.items.length ? (
          <p className={gradeCard}>No sections are assigned to you yet.</p>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-2">
              {query.data.items.map((section) => (
                <article className={gradeCard} key={section.id}>
                  <div className="flex flex-wrap justify-between gap-3">
                    <CourseSectionHeading
                      section={section}
                      ownerId={me.data?.id}
                      headingId={`assigned-course-${section.id}`}
                    />
                    <span className="text-brand-muted text-sm capitalize">{section.status}</span>
                  </div>
                  <p className="text-brand-muted mt-3 text-sm">Capacity: {section.capacity}</p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      className={gradeButton}
                      to="/sections/$sectionId/roster"
                      params={{ sectionId: section.id }}
                      aria-label={`Open roster for ${section.sectionName}`}
                      aria-describedby={`assigned-course-${section.id}`}
                    >
                      Open roster<span className="sr-only"> for {section.sectionName}</span>
                    </Link>
                    <Link
                      className={gradeButton}
                      to="/sections/$sectionId/grades"
                      params={{ sectionId: section.id }}
                      aria-label={`Enter grades for ${section.sectionName}`}
                      aria-describedby={`assigned-course-${section.id}`}
                    >
                      Enter grades<span className="sr-only"> for {section.sectionName}</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p role="status" className="text-brand-muted text-sm">
                Showing {query.data.offset + 1} to{" "}
                {Math.min(query.data.offset + query.data.items.length, query.data.total)} of{" "}
                {query.data.total} sections
              </p>
              <div className="flex gap-2">
                <button
                  className={gradeButton}
                  disabled={offset === 0 || query.isFetching}
                  onClick={() => setOffset(Math.max(0, offset - 20))}
                >
                  Previous
                </button>
                <button
                  className={gradeButton}
                  disabled={
                    offset + query.data.items.length >= query.data.total || query.isFetching
                  }
                  onClick={() => setOffset(offset + 20)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
