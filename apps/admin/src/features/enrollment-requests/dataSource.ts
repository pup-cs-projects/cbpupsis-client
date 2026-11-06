import { ApiError } from "@cbpupsis/shared/api";

import { toEnrollmentRequest } from "./reviewMapper";
import type { EnrollmentReviewDataSource, EnrollmentReviewTransport } from "./types";

/** Both mock and future authenticated transports use this mapper boundary. */
export function createEnrollmentReviewDataSource(
  transport: EnrollmentReviewTransport,
  isMock = false,
): EnrollmentReviewDataSource {
  return {
    isMock,
    async list(kind, signal) {
      signal.throwIfAborted();
      if (kind === "add-drop") {
        const items = (await transport.listAddDrop(signal)).map((data) =>
          toEnrollmentRequest({ kind, data }),
        );
        return { items, total: items.length };
      }
      if (kind === "overload") {
        const items = (await transport.listOverload(signal)).map((data) =>
          toEnrollmentRequest({ kind, data }),
        );
        return { items, total: items.length };
      }
      // The current waiver API accepts only limit/offset. Collect its pages before
      // applying the queue's client-side search, date filters and sorting.
      const first = await transport.listWaivers({ limit: 200, offset: 0 }, signal);
      const rows = [...first.items];
      let offset = first.offset + first.items.length;
      if (first.offset !== 0 || first.total < rows.length)
        throw new ApiError(0, "INVALID_RESPONSE");
      while (offset < first.total) {
        signal.throwIfAborted();
        const page = await transport.listWaivers({ limit: 200, offset }, signal);
        if (page.offset !== offset || !page.items.length || page.total !== first.total)
          throw new ApiError(0, "INVALID_RESPONSE");
        rows.push(...page.items);
        offset += page.items.length;
      }
      if (
        rows.length !== first.total ||
        new Set(rows.map((item) => item.waiverRequestId)).size !== rows.length
      )
        throw new ApiError(0, "INVALID_RESPONSE");
      return { items: rows.map((data) => toEnrollmentRequest({ kind, data })), total: first.total };
    },
    async decide(submission) {
      if (submission.kind === "add-drop")
        return toEnrollmentRequest({
          kind: submission.kind,
          data: await transport.decideAddDrop(submission.requestId, submission.body),
        });
      if (submission.kind === "overload")
        return toEnrollmentRequest({
          kind: submission.kind,
          data: await transport.decideOverload(submission.requestId, submission.body),
        });
      return toEnrollmentRequest({
        kind: submission.kind,
        data: await transport.decideWaiver(submission.requestId, submission.body),
      });
    },
  };
}

/** Supply an authenticated transport through createEnrollmentReviewDataSource when APIs are ready. */
export const enrollmentReviewDataSource: EnrollmentReviewDataSource | undefined = undefined;
