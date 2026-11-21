import type { Session } from "@cbpupsis/shared/auth";
import type { AdminEnrollmentApi } from "@cbpupsis/shared/enrollment";

import type { EnrollmentReviewTransport } from "./types";

/** Every call runs through the session, so an expired access token refreshes and retries once. */
export function createEnrollmentReviewTransport(
  api: AdminEnrollmentApi,
  session: Pick<Session, "authorized">,
): EnrollmentReviewTransport {
  return {
    listAddDrop: (signal) => session.authorized((token) => api.listAddDrop(token, signal)),
    listOverload: (signal) => session.authorized((token) => api.listOverload(token, signal)),
    listWaivers: (page, signal) =>
      session.authorized((token) => api.listWaivers(token, page, signal)),
    decideAddDrop: (id, body) => session.authorized((token) => api.decideAddDrop(token, id, body)),
    decideOverload: (id, body) =>
      session.authorized((token) => api.decideOverload(token, id, body)),
    decideWaiver: (id, body) => session.authorized((token) => api.decideWaiver(token, id, body)),
  };
}
