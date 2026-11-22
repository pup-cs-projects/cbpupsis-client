import {
  createAdminCatalogApi,
  type CatalogCourse,
  type CatalogCourseInput,
  type CatalogCoursePage,
  type CatalogSection,
  type CurriculumVersion,
  type CurriculumVersionInput,
  type SectionInput,
  type SectionUpdate,
  type SubstitutionApproval,
  type SubstitutionInput,
} from "@cbpupsis/shared/catalog";

import { apiClient, session } from "../../lib/auth";

/** What the catalog page needs, so tests can hand it a fake without touching HTTP. */
export interface CatalogDataSource {
  listCourses(
    query: { search: string; limit: number; offset: number },
    signal?: AbortSignal,
  ): Promise<CatalogCoursePage>;
  createCourse(body: CatalogCourseInput): Promise<CatalogCourse>;
  updateCourse(courseId: string, body: CatalogCourseInput): Promise<CatalogCourse>;
  publishVersion(programCode: string, body: CurriculumVersionInput): Promise<CurriculumVersion>;
  deleteVersion(versionId: string): Promise<void>;
  createSection(body: SectionInput): Promise<CatalogSection>;
  updateSection(sectionId: string, body: SectionUpdate): Promise<CatalogSection>;
  approveSubstitution(body: SubstitutionInput): Promise<SubstitutionApproval>;
}

const api = createAdminCatalogApi(apiClient);

export const catalogSource: CatalogDataSource = {
  listCourses: (query, signal) => session.authorized((t) => api.listCourses(t, query, signal)),
  createCourse: (body) => session.authorized((t) => api.createCourse(t, body)),
  updateCourse: (id, body) => session.authorized((t) => api.updateCourse(t, id, body)),
  publishVersion: (code, body) =>
    session.authorized((t) => api.publishCurriculumVersion(t, code, body)),
  deleteVersion: (id) => session.authorized((t) => api.deleteCurriculumVersion(t, id)),
  createSection: (body) => session.authorized((t) => api.createSection(t, body)),
  updateSection: (id, body) => session.authorized((t) => api.updateSection(t, id, body)),
  approveSubstitution: (body) => session.authorized((t) => api.approveSubstitution(t, body)),
};
