import type { CatalogSection, CurriculumVersion } from "@cbpupsis/shared/catalog";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CatalogDataSource } from "./dataSource";

export const PAGE_SIZE = 25;
/** The API's largest page: enough to pick requisites and courses from in one list. */
export const OPTIONS_SIZE = 200;

/** One key factory for the catalog page. Every key carries the admin, so scopes never mix. */
export const catalogKeys = {
  all: (adminId: string) => ["catalog", adminId] as const,
  courses: (adminId: string, search: string, offset: number) =>
    [...catalogKeys.all(adminId), "courses", { search, offset }] as const,
  courseOptions: (adminId: string) => [...catalogKeys.all(adminId), "course-options"] as const,
  // The API has no GET for versions or sections yet, so the page keeps what this session
  // published or created in the query cache, the same place server data always lives.
  versions: (adminId: string) => [...catalogKeys.all(adminId), "published-versions"] as const,
  sections: (adminId: string) => [...catalogKeys.all(adminId), "created-sections"] as const,
};

export function useCourses(
  source: CatalogDataSource,
  adminId: string,
  search: string,
  offset: number,
) {
  return useQuery({
    queryKey: catalogKeys.courses(adminId, search, offset),
    queryFn: ({ signal }) => source.listCourses({ search, limit: PAGE_SIZE, offset }, signal),
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** Every course in scope, for the requisite, curriculum, section, and substitution pickers. */
export function useCourseOptions(source: CatalogDataSource, adminId: string, enabled: boolean) {
  return useQuery({
    queryKey: catalogKeys.courseOptions(adminId),
    queryFn: ({ signal }) =>
      source.listCourses({ search: "", limit: OPTIONS_SIZE, offset: 0 }, signal),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

function useSessionList<T>(key: readonly unknown[]) {
  const client = useQueryClient();
  return useQuery<T[]>({
    queryKey: key,
    queryFn: () => client.getQueryData<T[]>(key) ?? [],
    initialData: [],
    staleTime: Infinity,
  });
}

export function usePublishedVersions(adminId: string) {
  return useSessionList<CurriculumVersion>(catalogKeys.versions(adminId));
}

export function useCreatedSections(adminId: string) {
  return useSessionList<CatalogSection>(catalogKeys.sections(adminId));
}
