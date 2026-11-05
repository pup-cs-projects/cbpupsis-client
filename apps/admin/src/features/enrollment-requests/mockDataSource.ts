import { ApiError } from "@cbpupsis/shared/api";

import { createMockRequests } from "./mockData";
import { canReview, isPending } from "./reviewRules";
import type { EnrollmentReviewDataSource, RequestState, ReviewerRole } from "./types";

/** In-memory implementation of the real adapter contract, for local development only. */
export function createMockReviewDataSource(
  ownerId: string,
  role: ReviewerRole,
): EnrollmentReviewDataSource {
  if (!ownerId) throw new Error("Mock review data requires a signed-in account");
  let requests = createMockRequests();

  return {
    isMock: true,
    async list(kind, signal) {
      signal.throwIfAborted();
      return structuredClone(requests.filter((request) => request.kind === kind));
    },
    async decide(kind, submission) {
      const current = requests.find(
        (request) => request.id === submission.requestId && request.kind === kind,
      );
      if (!current) throw new ApiError(404, "RESOURCE_NOT_FOUND");
      if (!isPending(current.state) || current.version !== submission.version)
        throw new ApiError(409, "REQUEST_ALREADY_DECIDED");
      if (!canReview(current, role))
        throw new ApiError(
          kind === "waivers" ? 409 : 403,
          kind === "waivers" ? "ENROLL_WAIVER_STEP_MISMATCH" : "AUTH_INSUFFICIENT_ROLE",
        );
      if (submission.decision === "REJECT" && !submission.remarks.trim())
        throw new ApiError(422, "DECISION_REMARKS_REQUIRED");
      if (
        submission.decision === "APPROVE" &&
        kind === "waivers" &&
        role === "registrar" &&
        !submission.vpaaReference.trim()
      )
        throw new ApiError(422, "VALIDATION_ERROR");

      let state: RequestState = "REJECTED";
      if (submission.decision === "APPROVE")
        state =
          kind !== "waivers" || current.state === "PENDING_VPAA"
            ? "APPROVED"
            : current.state === "PENDING_CHAIR"
              ? "PENDING_DEAN"
              : "PENDING_VPAA";
      const updated = {
        ...current,
        state,
        version: current.version + 1,
        history: [
          ...current.history,
          {
            role,
            decision: submission.decision,
            remarks: submission.remarks.trim(),
            occurredAt: new Date().toISOString(),
            ...(submission.vpaaReference.trim()
              ? { vpaaReference: submission.vpaaReference.trim() }
              : {}),
          },
        ],
      };
      requests = requests.map((request) => (request.id === current.id ? updated : request));
      return structuredClone(updated);
    },
  };
}
