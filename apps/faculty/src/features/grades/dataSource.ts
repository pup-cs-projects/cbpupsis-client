import type { FacultyGradeSheet } from "./gradingMode";
import { ApiError } from "@cbpupsis/shared/api";
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
const liveSource = createFacultyGradingDataSource(facultyGradesApi, session);
let sample: Promise<FacultyGradingDataSource> | undefined;
if (import.meta.env.DEV)
  session.subscribe(() => {
    sample = undefined;
  });
async function currentSource(): Promise<FacultyGradingDataSource> {
  if (import.meta.env.DEV && import.meta.env.VITE_FEATURE_MOCKS === "true") {
    if (!session.isSignedIn()) throw new ApiError(401, "NOT_SIGNED_IN");
    return (sample ??= import("./mockDataSource").then((module) =>
      module.createMockFacultyGradingDataSource(true),
    ));
  }
  return liveSource;
}
export const facultyGradingDataSource: FacultyGradingDataSource = {
  sections: async (signal) => (await currentSource()).sections(signal),
  sheet: async (id, signal) => (await currentSource()).sheet(id, signal),
  deadline: async (id, signal) => (await currentSource()).deadline(id, signal),
  saveDraft: async (id, input) => (await currentSource()).saveDraft(id, input),
  finalize: async (id, version) => (await currentSource()).finalize(id, version),
  incompletes: async (signal) => (await currentSource()).incompletes(signal),
  complete: async (id, input) => (await currentSource()).complete(id, input),
};
