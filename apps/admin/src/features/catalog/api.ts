import { createAdminCatalogApi } from "@cbpupsis/shared/catalog/admin";
import type {
  CourseInput,
  CurriculumInput,
  SectionInput,
  SubstitutionInput,
} from "@cbpupsis/shared/catalog/admin";
import { apiClient, session } from "../../lib/auth";

const api = createAdminCatalogApi(apiClient);
export const catalogApi = {
  courses: (search = "", offset = 0, signal?: AbortSignal, limit = 20) =>
    session.authorized((token) => api.courses(token, search, offset, signal, limit)),
  saveCourse: (input: CourseInput, id?: string) =>
    session.authorized((token) => api.saveCourse(token, input, id)),
  saveSection: (input: SectionInput, id?: string) =>
    session.authorized((token) => api.saveSection(token, input, id)),
  publishCurriculum: (program: string, input: CurriculumInput) =>
    session.authorized((token) => api.publishCurriculum(token, program, input)),
  deleteCurriculum: (program: string, id: string) =>
    session.authorized((token) => api.deleteCurriculum(token, program, id)),
  approveSubstitution: (input: SubstitutionInput) =>
    session.authorized((token) => api.approveSubstitution(token, input)),
  degreeProgress: (id: string, signal?: AbortSignal) =>
    session.authorized((token) => api.degreeProgress(token, id, signal)),
};
