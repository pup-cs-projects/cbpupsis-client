import { it, expect, vi } from "vitest";
import {
  createCorrectionApi,
  canReviewCorrection,
  correctionMark,
  type Correction,
  type CorrectionCodec,
} from "./corrections";
const item: Correction = {
  id: "one",
  version: 1,
  sectionId: "section/one",
  sectionLabel: "COMP 016",
  studentId: "student",
  studentName: "Ana",
  studentNumber: "2026-001",
  oldMark: "2.00",
  proposedMark: "1.50",
  reason: "Entry error",
  state: "PENDING_CHAIR",
  remarks: null,
  filerId: "author",
  actedBy: [],
  sheetName: "grades.pdf",
  sheetUrl: null,
};
const codec: CorrectionCodec = {
  list: () => [item],
  detail: () => item,
  sections: () => [],
  finalStudents: () => [],
  decision: (input) => input,
};
it("does not invent responses or request schemas before the codec is configured", async () => {
  const client = { request: vi.fn(), requestBlob: vi.fn() };
  await expect(createCorrectionApi(client, "faculty").list("token")).rejects.toHaveProperty(
    "code",
    "CORRECTIONS_NOT_CONFIGURED",
  );
  expect(client.request).not.toHaveBeenCalled();
});
it("uses role prefixes, authentication, and the documented multipart fields", async () => {
  const request = vi.fn().mockResolvedValue({});
  const client = { request, requestBlob: vi.fn() };
  const faculty = createCorrectionApi(client, "faculty", codec);
  await faculty.list("token");
  await faculty.detail("token", "one/two");
  await faculty.sections("token");
  await faculty.students("token", "section/one");
  await faculty.file("token", {
    sectionId: "section/one",
    studentId: "student",
    proposedMark: "1.50",
    reason: "Entry error",
    gradingSheet: new File(["sheet"], "grades.pdf"),
  });
  const admin = createCorrectionApi(client, "admin", codec);
  await admin.list("token");
  await admin.detail("token", "one");
  await admin.decide("token", "one", { version: 1, action: "ENDORSE", remarks: "" });
  expect(request.mock.calls.map((call) => call[0])).toEqual([
    "/faculty/grade-corrections",
    "/faculty/grade-corrections/one%2Ftwo",
    "/faculty/sections",
    "/faculty/sections/section%2Fone/grades",
    "/faculty/sections/section%2Fone/grade-corrections",
    "/admin/grade-corrections",
    "/admin/grade-corrections/one",
    "/admin/grade-corrections/one",
  ]);
  const body = request.mock.calls[4]![1].body as FormData;
  expect([...body.keys()]).toEqual(["student_id", "proposed_mark", "reason", "grading_sheet"]);
  for (const call of request.mock.calls) expect(call[1].accessToken).toBe("token");
  expect(request.mock.calls[7]![1].method).toBe("PATCH");
});
it.each(["chairperson", "dean", "registrar"])(
  "allows only the assigned approval step for %s",
  (role) => {
    const state =
      role === "dean"
        ? "PENDING_DEAN"
        : role === "registrar"
          ? "PENDING_REGISTRAR"
          : "PENDING_CHAIR";
    expect(canReviewCorrection(role, "reviewer", { ...item, state })).toBe(true);
    expect(canReviewCorrection(role, "author", { ...item, state })).toBe(false);
    expect(canReviewCorrection(role, "reviewer", { ...item, state, actedBy: ["reviewer"] })).toBe(
      false,
    );
    expect(canReviewCorrection(role, "reviewer", { ...item, state: "COMMITTED" })).toBe(false);
  },
);
it("denies Finance and validates the allowed mark range", () => {
  expect(canReviewCorrection("finance", "reviewer", item)).toBe(false);
  expect(correctionMark("1.5")).toBe("1.50");
  expect(correctionMark("inc")).toBe("INC");
  for (const value of ["0.99", "5.01", "1e0", "1.234", ""])
    expect(correctionMark(value)).toBeNull();
});
