import { ApiError } from "@cbpupsis/shared/api";
import type { FacultyGradeSheet } from "@cbpupsis/shared/grades";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { facultyGradingDataSource } from "../grades/dataSource";

/** Course labels only: never the grade rows of the sheet they came from. */
export interface CourseLabel {
  courseCode: string;
  courseTitle: string;
}

const FIVE_MINUTES = 5 * 60 * 1000;

export const courseLabelKey = (ownerId: string | undefined, sectionId: string) =>
  ["faculty-section-course", ownerId, sectionId] as const;

/**
 * The section-list DTO omits course labels. Pages that already hold a grade sheet (dashboard,
 * grade grid) store its labels here, so section cards and the roster reuse them instead of
 * loading the whole sheet again.
 */
export function rememberCourseLabel(
  client: QueryClient,
  ownerId: string | undefined,
  sectionId: string,
  code: string | null | undefined,
  title: string | null | undefined,
) {
  const courseCode = code?.trim() ?? "";
  const courseTitle = title?.trim() ?? "";
  if (!ownerId || (!courseCode && !courseTitle)) return;
  client.setQueryData<CourseLabel>(courseLabelKey(ownerId, sectionId), {
    courseCode,
    courseTitle,
  });
}

/** Reads cached labels first; otherwise resolves them through the section's owned grade sheet. */
export function useCourseLabel(
  sectionId: string,
  ownerId: string | undefined,
  {
    enabled = true,
    loadSheet = facultyGradingDataSource.sheet,
  }: {
    enabled?: boolean;
    loadSheet?: (id: string, signal?: AbortSignal) => Promise<FacultyGradeSheet>;
  } = {},
) {
  return useQuery({
    queryKey: courseLabelKey(ownerId, sectionId),
    queryFn: async ({ signal }): Promise<CourseLabel> => {
      const sheet = await loadSheet(sectionId, signal);
      if (sheet.section.id !== sectionId) throw new ApiError(0, "INVALID_RESPONSE");
      const courseCode = sheet.section.courseCode.trim();
      const courseTitle = sheet.section.courseTitle.trim();
      if (!courseCode && !courseTitle) throw new ApiError(0, "COURSE_DETAILS_UNAVAILABLE");
      return { courseCode, courseTitle };
    },
    enabled: Boolean(ownerId) && enabled,
    staleTime: FIVE_MINUTES,
    retry: false,
  });
}

/** "COMP 001 · Introduction to Computing", or "" while unknown. */
export function courseLabelText(label: Partial<CourseLabel> | null | undefined): string {
  return [label?.courseCode, label?.courseTitle].filter(Boolean).join(" · ");
}
