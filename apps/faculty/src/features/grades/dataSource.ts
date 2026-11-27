import type { FacultyGradeSheet } from "./gradingMode";
import type { FacultyGradesApi } from "@cbpupsis/shared/grades";
import type { Session } from "@cbpupsis/shared/auth";
import { facultyGradesApi, session } from "../../lib/auth";

export function createFacultyGradingDataSource(
  api: FacultyGradesApi,
  auth: Pick<Session, "authorized">,
) {
  return {
    sections: (signal?: AbortSignal) => auth.authorized((token) => api.sections(token, signal)),
    sheet: (id: string, signal?: AbortSignal) =>
      auth.authorized((token) => api.sheet(token, id, signal)),
    deadline: (id: string, signal?: AbortSignal) =>
      auth.authorized((token) => api.deadline(token, id, signal)),
    saveDraft: (id: string, input: Parameters<FacultyGradesApi["saveDraft"]>[2]) =>
      auth.authorized((token) => api.saveDraft(token, id, input)),
    finalize: (id: string, version: number) =>
      auth.authorized((token) => api.finalize(token, id, version)),
    incompletes: (signal?: AbortSignal) =>
      auth.authorized((token) => api.incompletes(token, signal)),
    complete: (id: string, input: Parameters<FacultyGradesApi["complete"]>[2]) =>
      auth.authorized((token) => api.complete(token, id, input)),
  };
}
export type FacultyGradingDataSource = Omit<
  ReturnType<typeof createFacultyGradingDataSource>,
  "sheet" | "saveDraft"
> & {
  sheet(id: string, signal?: AbortSignal): Promise<FacultyGradeSheet>;
  saveDraft(
    id: string,
    input: Parameters<FacultyGradesApi["saveDraft"]>[2],
  ): Promise<FacultyGradeSheet>;
};
export const facultyGradingDataSource: FacultyGradingDataSource = {
  ...createFacultyGradingDataSource(facultyGradesApi, session),
};
