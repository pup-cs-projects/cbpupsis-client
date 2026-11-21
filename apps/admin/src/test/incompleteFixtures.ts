import type { IncompleteCompletion } from "@cbpupsis/shared/grades";
import type { IncompleteReviewDataSource } from "../features/incomplete-completions/dataSource";
export const completionFixture: IncompleteCompletion = {
  id: "completion-1",
  version: 7,
  studentName: "Carlo Cruz",
  studentNumber: "2026-00003",
  courseCode: "COMP 016",
  sectionName: "BSCS 2-1",
  proposedMark: "2.00",
  filedAt: "2026-11-12T01:00:00Z",
  state: "PENDING_DEAN",
  formName: "completion-form.pdf",
  formUrl: null,
  remarks: null,
};
export function createReviewFixtureSource(): IncompleteReviewDataSource {
  let item = structuredClone(completionFixture);
  return {
    list: async () => [structuredClone(item)],
    detail: async () => structuredClone(item),
    decide: async (_id, input) => {
      item = {
        ...item,
        version: item.version + 1,
        state: input.decision === "ENDORSE" ? "ENDORSED" : "REJECTED",
        remarks: input.remarks,
      };
      return structuredClone(item);
    },
  };
}
