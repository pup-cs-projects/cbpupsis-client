import { createApiClient } from "@cbpupsis/shared/api";
import { createCorrectionApi, type CorrectionSource } from "@cbpupsis/shared/grades/corrections";
import { session } from "../../lib/auth";
// Supply the final response codec here once the backend contract is published.
const api = createCorrectionApi(
  createApiClient(import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1"),
  "faculty",
);
export const correctionSource: CorrectionSource = {
  list: (signal) => session.authorized((t) => api.list(t, signal)),
  detail: (id, signal) => session.authorized((t) => api.detail(t, id, signal)),
  sections: (signal) => session.authorized((t) => api.sections(t, signal)),
  students: (id, signal) => session.authorized((t) => api.students(t, id, signal)),
  file: (input) => session.authorized((t) => api.file(t, input)),
  decide: (id, input) => session.authorized((t) => api.decide(t, id, input)),
};
