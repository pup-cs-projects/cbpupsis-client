import type { FacultyGradeSheet, GradingSection } from "@cbpupsis/shared/grades";
import { facultyGradingDataSource } from "../grades/dataSource";
import { useCourseLabel } from "./courseLabels";

type SectionIdentity = Pick<GradingSection, "id" | "sectionName"> &
  Partial<Pick<GradingSection, "courseCode" | "courseTitle">>;

/** The section-list DTO omits course labels; resolve them from the shared course-label cache. */
export function CourseSectionHeading({
  section,
  ownerId,
  headingId,
  loadSheet = facultyGradingDataSource.sheet,
}: {
  section: SectionIdentity;
  ownerId: string | undefined;
  headingId: string;
  loadSheet?: (id: string, signal?: AbortSignal) => Promise<FacultyGradeSheet>;
}) {
  const providedCode = section.courseCode?.trim();
  const providedTitle = section.courseTitle?.trim();
  const details = useCourseLabel(section.id, ownerId, {
    enabled: !(providedCode && providedTitle),
    loadSheet,
  });
  const course = [
    providedCode || details.data?.courseCode,
    providedTitle || details.data?.courseTitle,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-w-0">
      <h2 id={headingId} className="text-brand-maroon text-xl font-bold break-words">
        {course || section.sectionName}
      </h2>
      {course && <p className="text-brand-muted mt-2 text-sm">Section: {section.sectionName}</p>}
      {details.isFetching && !course && (
        <p role="status" className="text-brand-muted mt-2 text-sm">
          Loading course information…
        </p>
      )}
      {details.isError && (
        <div className="mt-2 text-sm">
          <p role="alert" className="text-brand-muted">
            Course information could not be loaded.
          </p>
          <button
            type="button"
            aria-describedby={headingId}
            className="text-brand-maroon mt-2 inline-flex min-h-11 cursor-pointer items-center rounded-sm underline underline-offset-2"
            onClick={() => void details.refetch()}
          >
            Retry course information
          </button>
        </div>
      )}
    </div>
  );
}
