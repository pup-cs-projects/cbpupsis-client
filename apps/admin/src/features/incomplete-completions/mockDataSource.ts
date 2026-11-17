import { ApiError } from "@cbpupsis/shared/api";
import type { IncompleteCompletion } from "@cbpupsis/shared/grades";
import type { IncompleteReviewDataSource } from "./dataSource";
/** SAMPLE_INC_REVIEW: independent local examples; never commits a real student grade. */
export function createMockIncompleteReviewSource(
  scenario = import.meta.env.VITE_FEATURE_MOCK_SCENARIO ?? "ready",
): IncompleteReviewDataSource {
  let firstRead = true;
  const items: IncompleteCompletion[] = [
    {
      id: "sample-completion",
      version: 1,
      studentName: "Carlo Cruz",
      studentNumber: "2026-00003-DM-0",
      courseCode: "COMP 016",
      sectionName: "BSCS 3-1",
      proposedMark: "2.00",
      filedAt: new Date().toISOString(),
      state: "PENDING_DEAN",
      formName: "sample-completion.pdf",
      formUrl: null,
      remarks: null,
    },
  ];
  const get = (id: string) => {
    const item = items.find((item) => item.id === id);
    if (!item) throw new ApiError(404, "RESOURCE_NOT_FOUND");
    return item;
  };
  return {
    list: async (signal) => {
      signal?.throwIfAborted();
      if (scenario === "error" && firstRead) {
        firstRead = false;
        throw new ApiError(503, "SAMPLE_SERVICE_UNAVAILABLE");
      }
      return scenario === "empty" ? [] : structuredClone(items);
    },
    detail: async (id) => structuredClone(get(id)),
    decide: async (id, input) => {
      const item = get(id);
      if (item.version !== input.version || item.state !== "PENDING_DEAN")
        throw new ApiError(409, "VERSION_CONFLICT");
      if (input.decision === "REJECT" && !input.remarks.trim())
        throw new ApiError(422, "DECISION_REMARKS_REQUIRED");
      item.state = input.decision === "REJECT" ? "REJECTED" : "ENDORSED";
      item.version++;
      item.remarks = input.remarks.trim() || null;
      return structuredClone(item);
    },
  };
}
