import { ApiError, createApiClient } from "@cbpupsis/shared/api";
import { createCorrectionApi, type CorrectionSource } from "@cbpupsis/shared/grades/corrections";
import { authApi, session } from "../../lib/auth";
// Supply the final response codec here once the backend contract is published.
const api = createCorrectionApi(
  createApiClient(import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1"),
  "admin",
);
const liveSource: CorrectionSource = {
  list: (signal) => session.authorized((t) => api.list(t, signal)),
  detail: (id, signal) => session.authorized((t) => api.detail(t, id, signal)),
  sections: (signal) => session.authorized((t) => api.sections(t, signal)),
  students: (id, signal) => session.authorized((t) => api.students(t, id, signal)),
  file: (input) => session.authorized((t) => api.file(t, input)),
  decide: (id, input) => session.authorized((t) => api.decide(t, id, input)),
};

let sample: Promise<CorrectionSource> | undefined;
if (import.meta.env.DEV)
  session.subscribe(() => {
    sample = undefined;
  });
async function currentSource(): Promise<CorrectionSource> {
  if (import.meta.env.DEV && import.meta.env.VITE_FEATURE_MOCKS === "true") {
    if (!session.isSignedIn()) throw new ApiError(401, "NOT_SIGNED_IN");
    return (sample ??= Promise.all([
      import("@cbpupsis/shared/grades/correction-samples"),
      session.authorized(authApi.me),
    ])
      .then(([module, user]) =>
        module.createSampleCorrectionSource(
          "admin",
          user.id,
          user.position,
          import.meta.env.VITE_FEATURE_MOCK_SCENARIO,
        ),
      )
      .catch((error) => {
        sample = undefined;
        throw error;
      }));
  }
  return liveSource;
}
export const correctionSource: CorrectionSource = {
  list: async (signal) => (await currentSource()).list(signal),
  detail: async (id, signal) => (await currentSource()).detail(id, signal),
  sections: async (signal) => (await currentSource()).sections(signal),
  students: async (id, signal) => (await currentSource()).students(id, signal),
  file: async (input) => (await currentSource()).file(input),
  decide: async (id, input) => (await currentSource()).decide(id, input),
};
