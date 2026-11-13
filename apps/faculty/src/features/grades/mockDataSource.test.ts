import { describe, it, expect } from "vitest";
import { createMockFacultyGradingDataSource } from "./mockDataSource";
describe("Local sample grading source", () => {
  it("saves canonical grades and finalizes the saved version, then refuses writes", async () => {
    const source = createMockFacultyGradingDataSource();
    const sheet = await source.sheet("sample-computing");
    const input = {
      version: sheet.version,
      grades: sheet.rows.map((row) => ({ studentId: row.studentId, mark: "2.00" })),
    };
    const saved = await source.saveDraft(sheet.section.id, input);
    expect(saved.version).toBe(2);
    expect(saved.rows.every((row) => row.mark === "2.00")).toBe(true);
    const result = await source.finalize(sheet.section.id, saved.version);
    expect(result.state).toBe("FINAL");
    await expect(
      source.saveDraft(sheet.section.id, { ...input, version: result.version }),
    ).rejects.toMatchObject({ code: "GRADES_LOCKED" });
  });
  it("rejects stale versions without changing the sample sheet", async () => {
    const source = createMockFacultyGradingDataSource();
    await expect(
      source.saveDraft("sample-computing", { version: 99, grades: [] }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect((await source.sheet("sample-computing")).version).toBe(1);
  });
  it("does not finalize a section with an unmarked student", async () => {
    const source = createMockFacultyGradingDataSource();
    await expect(source.finalize("sample-computing", 1)).rejects.toMatchObject({ status: 422 });
    expect((await source.sheet("sample-computing")).state).toBe("DRAFT");
  });
  it("supports empty data and a recoverable read error", async () => {
    expect(await createMockFacultyGradingDataSource(false, "empty").sections()).toEqual([]);
    const source = createMockFacultyGradingDataSource(false, "error");
    await expect(source.sections()).rejects.toMatchObject({ status: 503 });
    expect((await source.sections()).length).toBeGreaterThan(0);
  });
  it("uses a closed deadline while keeping draft saves available", async () => {
    const source = createMockFacultyGradingDataSource(false, "closed");
    expect((await source.deadline("sample-computing")).passed).toBe(true);
    await expect(source.finalize("sample-computing", 1)).rejects.toMatchObject({
      code: "GRADE_DEADLINE_PASSED",
    });
    await expect(
      source.saveDraft("sample-computing", { version: 1, grades: [] }),
    ).resolves.toMatchObject({ state: "DRAFT", version: 2 });
  });
  it("records completion as pending without replacing the Inc", async () => {
    const source = createMockFacultyGradingDataSource();
    await source.complete("sample-inc", {
      mark: "2.00",
      form: new File(["sample"], "completion.pdf", { type: "application/pdf" }),
    });
    expect((await source.incompletes())[0]?.completionPending).toBe(true);
    expect((await source.sheet("sample-computing")).rows[2]?.mark).toBe("INC");
  });
  it("offers Pass/Fail examples only when explicitly requested", async () => {
    const numeric = createMockFacultyGradingDataSource();
    expect((await numeric.sections()).some((item) => item.id === "sample-nstp")).toBe(false);
    const source = createMockFacultyGradingDataSource(true);
    const sheet = await source.sheet("sample-nstp");
    expect(sheet).toMatchObject({ gradingMode: "PASS_FAIL", allowedMarks: ["PASS", "FAIL"] });
    await expect(
      source.saveDraft("sample-nstp", {
        version: 1,
        grades: sheet.rows.map((row) => ({ studentId: row.studentId, mark: "2.00" })),
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("keeps separate sample sessions isolated", async () => {
    const first = createMockFacultyGradingDataSource();
    await first.saveDraft("sample-computing", { version: 1, grades: [] });
    expect((await createMockFacultyGradingDataSource().sheet("sample-computing")).version).toBe(1);
  });
});
