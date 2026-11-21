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
export const incompleteReviewDataSource = createIncompleteReviewDataSource(
  incompleteReviewApi,
  session,
);
