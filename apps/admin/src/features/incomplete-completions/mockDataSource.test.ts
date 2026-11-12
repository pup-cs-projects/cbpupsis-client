import { describe, it, expect } from "vitest";
import { createMockIncompleteReviewSource } from "./mockDataSource";
describe("Local Dean review samples", () => {
  it("requires rejection remarks and preserves the pending request after refusal", async () => {
    const source = createMockIncompleteReviewSource();
    await expect(
      source.decide("sample-completion", { version: 1, decision: "REJECT", remarks: " " }),
    ).rejects.toMatchObject({ code: "DECISION_REMARKS_REQUIRED" });
    expect((await source.detail("sample-completion")).state).toBe("PENDING_DEAN");
  });
  it("endorses once and refuses stale decisions", async () => {
    const source = createMockIncompleteReviewSource();
    expect(
      await source.decide("sample-completion", {
        version: 1,
        decision: "ENDORSE",
        remarks: "Verified",
      }),
    ).toMatchObject({ state: "ENDORSED", version: 2 });
    await expect(
      source.decide("sample-completion", { version: 1, decision: "ENDORSE", remarks: "" }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });
  it("shows empty and retryable-error scenarios", async () => {
    expect(await createMockIncompleteReviewSource("empty").list()).toEqual([]);
    const source = createMockIncompleteReviewSource("error");
    await expect(source.list()).rejects.toMatchObject({ status: 503 });
    expect((await source.list()).length).toBe(1);
  });
});
