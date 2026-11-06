import { ApiError } from "@cbpupsis/shared/api";

import { createEnrollmentReviewDataSource } from "./dataSource";
import { createMockRequests } from "./mockData";
import type { EnrollmentReviewDataSource, ReviewerRole } from "./types";

/** Wire-level mock transport. No network, persistence, or authentication bypass. */
export function createMockReviewDataSource(
  ownerId: string,
  role: ReviewerRole,
): EnrollmentReviewDataSource {
  if (!ownerId) throw new Error("Mock review data requires a signed-in account");
  const records = createMockRequests();
  function remarksRequired(decision: string, remarks?: string | null) {
    if (decision === "REJECT" && !remarks?.trim())
      throw new ApiError(422, "DECISION_REMARKS_REQUIRED");
  }
  return createEnrollmentReviewDataSource(
    {
      async listAddDrop(signal) {
        signal.throwIfAborted();
        return structuredClone(records.addDrop);
      },
      async listOverload(signal) {
        signal.throwIfAborted();
        return structuredClone(records.overload);
      },
      async listWaivers({ limit, offset }, signal) {
        signal.throwIfAborted();
        return structuredClone({
          items: records.waivers.items.slice(offset, offset + limit),
          total: records.waivers.total,
          limit,
          offset,
        });
      },
      async decideAddDrop(id, body) {
        const item = records.addDrop.find((row) => row.requestId === id);
        if (!item) throw new ApiError(404, "RESOURCE_NOT_FOUND");
        if (role === "registrar") throw new ApiError(403, "AUTH_INSUFFICIENT_ROLE");
        if (item.state !== "PENDING" || body.version !== item.version)
          throw new ApiError(409, "REQUEST_ALREADY_DECIDED");
        remarksRequired(body.decision, body.remarks);
        Object.assign(item, {
          state: body.decision === "APPROVE" ? "APPROVED" : "REJECTED",
          version: (item.version ?? 1) + 1,
          reviewedBy: ownerId,
          reviewedAt: new Date().toISOString(),
          remarks: body.remarks ?? null,
        });
        return structuredClone(item);
      },
      async decideOverload(id, body) {
        const item = records.overload.find((row) => row.overloadRequestId === id);
        if (!item) throw new ApiError(404, "RESOURCE_NOT_FOUND");
        if (role !== "dean") throw new ApiError(403, "AUTH_INSUFFICIENT_ROLE");
        if (item.state !== "PENDING_DEAN") throw new ApiError(409, "REQUEST_ALREADY_DECIDED");
        remarksRequired(body.decision, body.remarks);
        Object.assign(item, {
          state: body.decision === "APPROVE" ? "APPROVED" : "REJECTED",
          reviewedBy: ownerId,
          reviewedAt: new Date().toISOString(),
          remarks: body.remarks ?? null,
        });
        return structuredClone(item);
      },
      async decideWaiver(id, body) {
        const item = records.waivers.items.find((row) => row.waiverRequestId === id);
        if (!item) throw new ApiError(404, "RESOURCE_NOT_FOUND");
        if (item.state === "APPROVED" || item.state === "REJECTED")
          throw new ApiError(409, "REQUEST_ALREADY_DECIDED");
        const stages = {
          chairperson: "PENDING_CHAIR",
          dean: "PENDING_DEAN",
          registrar: "PENDING_VPAA",
        };
        if (item.state !== stages[role]) throw new ApiError(409, "ENROLL_WAIVER_STEP_MISMATCH");
        remarksRequired(body.decision, body.remarks);
        if (role === "registrar" && body.decision === "APPROVE" && !body.vpaaReference?.trim())
          throw new ApiError(422, "VALIDATION_ERROR");
        item.state =
          body.decision === "REJECT"
            ? "REJECTED"
            : role === "chairperson"
              ? "PENDING_DEAN"
              : role === "dean"
                ? "PENDING_VPAA"
                : "APPROVED";
        item.reviewRemarks = body.remarks ?? null;
        item.vpaaReference =
          role === "registrar" ? (body.vpaaReference ?? null) : item.vpaaReference;
        return structuredClone(item);
      },
    },
    true,
  );
}
