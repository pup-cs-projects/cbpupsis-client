import { expect, it, vi } from "vitest";
import type { ApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import { createFacultyGradesApi, createIncompleteReviewApi, normalizeGrade } from "./faculty";
import { facultyGradesContract, incompleteReviewContract } from "./facultyContract";
const sheet = {
  sectionId: "s1",
  sectionName: "BSCS 2-1",
  courseCode: "COMP 001",
  courseTitle: "Computing",
  state: "DRAFT",
  version: 2,
  submittedAt: null,
  grades: [
    {
      studentId: "u1",
      studentNumber: "S-1",
      studentName: "Ana",
      finalGrade: "INC",
      completionDeadline: "2027-01-01T00:00:00Z",
    },
  ],
};
const completion = {
  completionId: "c1",
  version: 3,
  studentName: "Ana",
  studentNumber: "S-1",
  courseCode: "COMP 001",
  sectionName: "BSCS 2-1",
  proposedMark: "1.50",
  createdAt: "2026-11-18T00:00:00Z",
  state: "PENDING_DEAN",
  reviewRemarks: null,
};
function http() {
  return { request: vi.fn<ApiClient["request"]>(), requestBlob: vi.fn<ApiClient["requestBlob"]>() };
}
it("AC-FAC-001.1/.3: maps the real sheet and encodes versioned finalGrade writes without clearing other grade fields", async () => {
  const client = http();
  client.request.mockResolvedValue(sheet);
  const api = createFacultyGradesApi(client, facultyGradesContract);
  const saved = await api.saveDraft("token", "s1", {
    version: 1,
    grades: [{ studentId: "u1", mark: "1.25" }],
  });
  expect(saved.rows[0]?.completionDeadline).toBe("2027-01-01T00:00:00Z");
  expect(saved.allowedMarks).toContain("INC");
  expect(saved.allowedMarks).not.toContain("PASS");
  expect(saved.savedAt).not.toBeNull();
  expect(client.request.mock.calls[0]?.[1]?.body).toEqual({
    version: 1,
    grades: [{ studentId: "u1", finalGrade: "1.25" }],
  });
});
it("AC-FAC-001.1: reads every page of assigned sections", async () => {
  const client = http();
  const section = { id: "s1", section_name: "BSCS 2-1", capacity: 40, status: "open" };
  client.request
    .mockResolvedValueOnce({ items: [section], total: 2, limit: 1, offset: 0 })
    .mockResolvedValueOnce({ items: [{ ...section, id: "s2" }], total: 2, limit: 1, offset: 1 });
  expect(
    await createFacultyGradesApi(client, facultyGradesContract).sections("token"),
  ).toHaveLength(2);
  expect(client.request.mock.calls[1]?.[0]).toBe("/faculty/sections?limit=200&offset=1");
});
it("AC-FAC-001.1: maps server row validation to each student without retrying", async () => {
  const client = http();
  client.request.mockRejectedValue(
    new ApiError(422, "VALIDATION_ERROR", {
      details: { rows: [{ studentId: "u1", message: "Invalid mark." }] },
    }),
  );
  await expect(
    createFacultyGradesApi(client, facultyGradesContract).saveDraft("token", "s1", {
      version: 1,
      grades: [],
    }),
  ).rejects.toHaveProperty("fields", { u1: "Invalid mark." });
  expect(client.request).toHaveBeenCalledTimes(1);
});
it("AC-FAC-001.5: sends the passing mark and uploaded form reference", () => {
  expect(
    facultyGradesContract.completionBody({ mark: "1.50", completionFormFileId: "form-1" }),
  ).toEqual({ proposedMark: "1.50", completionFormFileId: "form-1" });
});
it("AC-FAC-001.5/.6: reviews list records without an unsupported detail GET and preserves the decision version", async () => {
  const client = http();
  client.request
    .mockResolvedValueOnce({ items: [completion], total: 1, limit: 200, offset: 0 })
    .mockResolvedValueOnce({ ...completion, state: "ENDORSED", version: 4 });
  const api = createIncompleteReviewApi(client, incompleteReviewContract);
  expect((await api.detail("token", "c1")).version).toBe(3);
  await api.decide("token", "c1", { version: 3, decision: "ENDORSE", remarks: "Verified" });
  expect(client.request.mock.calls.map(([path, options]) => [path, options?.method])).toEqual([
    ["/admin/incomplete-completions?limit=200&offset=0", "GET"],
    ["/admin/incomplete-completions/c1", "PATCH"],
  ]);
  expect(client.request.mock.calls[1]?.[1]?.body).toEqual({
    version: 3,
    decision: "ENDORSE",
    remarks: "Verified",
  });
});
it.each(["1.01", "3.25", "4.00", "4.75"])(
  "AC-FAC-001.1: refuses %s outside the API's numeric mark set",
  (mark) => expect(normalizeGrade(mark)).toBeNull(),
);
it("AC-FAC-001.7: accepts expired review records", () =>
  expect(incompleteReviewContract.detail({ ...completion, state: "EXPIRED" }).state).toBe(
    "EXPIRED",
  ));
it("AC-FAC-001.5: accepts an endorsed response with empty optional review remarks", () => {
  expect(
    incompleteReviewContract.detail({ ...completion, state: "ENDORSED", reviewRemarks: "" }),
  ).toMatchObject({
    state: "ENDORSED",
    remarks: null,
  });
});

it("AC-FAC-003.1/.6: reads the published Pass/Fail sheet and preserves marks in versioned draft writes", async () => {
  const client = http();
  client.request.mockResolvedValue({
    ...sheet,
    gradingMode: "PASS_FAIL",
    allowedMarks: ["PASS", "FAIL"],
    grades: [{ ...sheet.grades[0], finalGrade: "PASS", completionDeadline: null }],
  });
  const result = await createFacultyGradesApi(client, facultyGradesContract).saveDraft(
    "token",
    "s1",
    {
      version: 1,
      grades: [{ studentId: "u1", mark: "PASS" }],
    },
  );
  expect(result.gradingMode).toBe("PASS_FAIL");
  expect(result.allowedMarks).toEqual(["PASS", "FAIL"]);
  expect(result.rows[0]?.mark).toBe("PASS");
  expect(client.request.mock.calls[0]?.[1]?.body).toEqual({
    version: 1,
    grades: [{ studentId: "u1", finalGrade: "PASS" }],
  });
});
it("AC-FAC-003.1: honors the numeric marks returned by newer servers without adding choices", () => {
  const result = facultyGradesContract.sheet({
    ...sheet,
    gradingMode: "NUMERIC",
    allowedMarks: ["1.00", "5.00"],
  });
  expect(result.allowedMarks).toEqual(["1.00", "5.00"]);
});
it.each([
  { gradingMode: "OTHER", allowedMarks: ["PASS"] },
  { gradingMode: "PASS_FAIL" },
  { allowedMarks: ["PASS", "FAIL"] },
  { gradingMode: "PASS_FAIL", allowedMarks: [] },
  { gradingMode: "PASS_FAIL", allowedMarks: ["1.00"] },
  { gradingMode: "NUMERIC", allowedMarks: ["PASS"] },
  { gradingMode: "NUMERIC", allowedMarks: ["4.00"] },
])("AC-FAC-003.1: refuses incomplete or incompatible server mode metadata %j", (metadata) => {
  expect(() => facultyGradesContract.sheet({ ...sheet, ...metadata })).toThrow();
});
