import { createCorrectionApi, type CorrectionSource } from "@cbpupsis/shared/grades/corrections";
import { correctionCodec } from "@cbpupsis/shared/grades/correction-contract";
import { apiClient, session } from "../../lib/auth";
const api = createCorrectionApi(apiClient, "faculty", correctionCodec);
export const correctionSource: CorrectionSource = {
  list: (signal) => session.authorized((t) => api.list(t, signal)),
  detail: (id, signal) => session.authorized((t) => api.detail(t, id, signal)),
  sections: (signal) => session.authorized((t) => api.sections(t, signal)),
  students: (id, signal) => session.authorized((t) => api.students(t, id, signal)),
  file: (input) => session.authorized((t) => api.file(t, input)),
  decide: (id, input) => session.authorized((t) => api.decide(t, id, input)),
};
