import { ApiError } from "@cbpupsis/shared/api";
import type { Session } from "@cbpupsis/shared/auth";
import type { IncompleteReviewApi } from "@cbpupsis/shared/grades";
import { incompleteReviewApi, session } from "../../lib/auth";

export function createIncompleteReviewDataSource(
  api: IncompleteReviewApi,
  auth: Pick<Session, "authorized">,
) {
  return {
    list: (signal?: AbortSignal) => auth.authorized((token) => api.list(token, signal)),
    detail: (id: string, signal?: AbortSignal) =>
      auth.authorized((token) => api.detail(token, id, signal)),
    decide: (id: string, input: Parameters<IncompleteReviewApi["decide"]>[2]) =>
      auth.authorized((token) => api.decide(token, id, input)),
  };
}
export type IncompleteReviewDataSource = ReturnType<typeof createIncompleteReviewDataSource>;
const liveSource = createIncompleteReviewDataSource(incompleteReviewApi, session);
let sample: Promise<IncompleteReviewDataSource> | undefined;
if (import.meta.env.DEV)
  session.subscribe(() => {
    sample = undefined;
  });
async function currentSource(): Promise<IncompleteReviewDataSource> {
  if (import.meta.env.DEV && import.meta.env.VITE_FEATURE_MOCKS === "true") {
    if (!session.isSignedIn()) throw new ApiError(401, "NOT_SIGNED_IN");
    return (sample ??= import("./mockDataSource").then((module) =>
      module.createMockIncompleteReviewSource(),
    ));
  }
  return liveSource;
}
export const incompleteReviewDataSource: IncompleteReviewDataSource = {
  list: async (signal) => (await currentSource()).list(signal),
  detail: async (id, signal) => (await currentSource()).detail(id, signal),
  decide: async (id, input) => (await currentSource()).decide(id, input),
};
