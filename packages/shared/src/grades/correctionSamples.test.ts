import { describe, it, expect } from "vitest";
import { createSampleCorrectionSource } from "./correctionSamples";
describe("Development correction samples", () => {
  it.each([
    ["chairperson", "sample-correction-0", "ENDORSE", "PENDING_DEAN"],
    ["dean", "sample-correction-1", "ENDORSE", "PENDING_REGISTRAR"],
    ["registrar", "sample-correction-2", "COMMIT", "COMMITTED"],
  ] as const)("supports %s actions once with version checks", async (role, id, action, state) => {
    const source = createSampleCorrectionSource("admin", "reviewer", role);
    expect(await source.decide(id, { version: 1, action, remarks: "Verified" })).toMatchObject({
      state,
      version: 2,
    });
    await expect(source.decide(id, { version: 2, action, remarks: "" })).rejects.toMatchObject({
      code: "APPROVAL_SAME_ACTOR",
    });
  });
  it("denies Finance and refuses out-of-order decisions", async () => {
    await expect(
      createSampleCorrectionSource("admin", "finance", "finance").list(),
    ).rejects.toMatchObject({ status: 403 });
    const source = createSampleCorrectionSource("admin", "dean", "dean");
    await expect(
      source.decide("sample-correction-0", { version: 1, action: "ENDORSE", remarks: "" }),
    ).rejects.toMatchObject({ code: "APPROVAL_OUT_OF_ORDER" });
  });
  it("requires rejection remarks and keeps the pending record unchanged", async () => {
    const source = createSampleCorrectionSource("admin", "chair", "chairperson");
    await expect(
      source.decide("sample-correction-0", { version: 1, action: "REJECT", remarks: " " }),
    ).rejects.toMatchObject({ code: "DECISION_REMARKS_REQUIRED" });
    expect((await source.detail("sample-correction-0")).state).toBe("PENDING_CHAIR");
  });
  it("files a pending request without changing the recorded grade", async () => {
    const source = createSampleCorrectionSource("faculty", "author", "faculty");
    const input = {
      sectionId: "sample-final",
      studentId: "sample-student",
      proposedMark: "1.75",
      reason: "Entry error",
      gradingSheet: new File(["sample"], "grading.pdf", { type: "application/pdf" }),
    };
    expect(await source.file(input)).toMatchObject({
      state: "PENDING_CHAIR",
      filerId: "author",
      oldMark: "2.00",
    });
    expect((await source.students("sample-final"))[0]?.finalMark).toBe("2.00");
    await expect(
      createSampleCorrectionSource("faculty", "author", "faculty", "closed").file(input),
    ).rejects.toMatchObject({ code: "CORRECTION_WINDOW_CLOSED" });
  });
  it("provides isolated empty data and an error that can be retried", async () => {
    expect(await createSampleCorrectionSource("faculty", "one", "faculty", "empty").list()).toEqual(
      [],
    );
    const source = createSampleCorrectionSource("faculty", "one", "faculty", "error");
    await expect(source.list()).rejects.toMatchObject({ status: 503 });
    expect((await source.list()).length).toBe(4);
  });
});
