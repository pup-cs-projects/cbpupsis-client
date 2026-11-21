import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import { canReviewCorrection, correctionMark, createCorrectionApi } from "./corrections";
import { correctionCodec } from "./correctionContract";

const row = {
  id: "correction-1",
  gradeId: "grade-1",
  studentId: "student-1",
  sectionId: "section-1",
  facultyId: "faculty-1",
  currentMark: "2.00",
  proposedMark: "1.50",
  reason: "Transcription error",
  gradingSheetFileId: "private-file",
  gradingSheetContentType: "application/pdf",
  gradingSheetSize: 2048,
  gradingSheetSha256: "a".repeat(64),
  state: "PENDING_CHAIR",
  version: 1,
  windowClosedAt: "2027-05-01T15:59:59Z",
  chairApprovedBy: null,
  chairApprovedAt: null,
  deanApprovedBy: null,
  deanApprovedAt: null,
  registrarApprovedBy: null,
  registrarApprovedAt: null,
  rejectedBy: null,
  rejectionRemarks: null,
  resolvedAt: null,
  createdAt: "2026-11-19T01:00:00Z",
};
const page = (items: unknown[], offset = 0, total = items.length) => ({
  items,
  total,
  limit: 100,
  offset,
});
function client() {
  return { request: vi.fn<ApiClient["request"]>(), requestBlob: vi.fn<ApiClient["requestBlob"]>() };
}

describe("Published fr004 Correction of Entry contract", () => {
  it("AC-FAC-002.1/.7: maps returned IDs, workflow, actors, timestamps and rejection remarks without invented personal fields or URLs", () => {
    const item = correctionCodec.detail({
      ...row,
      state: "REJECTED",
      chairApprovedBy: "chair-1",
      rejectedBy: "dean-1",
      rejectionRemarks: "Missing signature.",
    });
    expect(item).toMatchObject({
      id: "correction-1",
      studentId: "student-1",
      studentName: null,
      studentNumber: null,
      sectionLabel: null,
      filerId: "faculty-1",
      actedBy: ["chair-1", "dean-1"],
      remarks: "Missing signature.",
      sheetUrl: null,
      sheetContentType: "application/pdf",
      sheetSize: 2048,
    });
    expect(item.sheetName).not.toBe("private-file");
  });
  it("AC-FAC-002.1: loads every page using the API's maximum correction page size", async () => {
    const http = client();
    http.request
      .mockResolvedValueOnce(page([row], 0, 2))
      .mockResolvedValueOnce(page([{ ...row, id: "correction-2" }], 1, 2));
    const items = await createCorrectionApi(http, "faculty", correctionCodec).list("access");
    expect(items).toHaveLength(2);
    expect(http.request.mock.calls.map(([path]) => path)).toEqual([
      "/faculty/grade-corrections?limit=100&offset=0",
      "/faculty/grade-corrections?limit=100&offset=1",
    ]);
  });
  it("AC-FAC-002.1: loads assigned sections with their snake_case names and paginated envelope", async () => {
    const http = client();
    http.request.mockResolvedValue({
      items: [{ id: "section-1", section_name: "BSCS 2-1", capacity: 40, status: "open" }],
      total: 1,
      limit: 200,
      offset: 0,
    });
    expect(await createCorrectionApi(http, "faculty", correctionCodec).sections("access")).toEqual([
      { id: "section-1", label: "BSCS 2-1" },
    ]);
  });
  it("AC-FAC-002.1: offers only published, locked, non-draft student grades for filing", () => {
    const final = {
      studentId: "student-1",
      studentName: "Ana Santos",
      studentNumber: "S-1",
      finalGrade: "2.00",
      status: "FINAL",
      isLocked: true,
      isDraft: false,
    };
    const sheet = {
      state: "FINAL",
      grades: [
        final,
        { ...final, studentId: "draft", isDraft: true },
        { ...final, studentId: "unlocked", isLocked: false },
        { ...final, studentId: "missing", status: "MISSING" },
      ],
    };
    expect(correctionCodec.finalStudents(sheet)).toEqual([
      { id: "student-1", name: "Ana Santos", studentNumber: "S-1", finalMark: "2.00" },
    ]);
    expect(correctionCodec.finalStudents({ ...sheet, state: "DRAFT" })).toEqual([]);
  });
  it("AC-FAC-002.1: sends exactly the documented multipart names and preserves the file bytes", async () => {
    const http = client();
    http.request.mockResolvedValue(row);
    const file = new File(["%PDF-evidence"], "grades.pdf", { type: "" });
    await createCorrectionApi(http, "faculty", correctionCodec).file("access", {
      sectionId: "section/1",
      studentId: "student-1",
      proposedMark: "1.50",
      reason: "Transcription error",
      gradingSheet: file,
    });
    const [path, options] = http.request.mock.calls[0]!;
    expect(path).toBe("/faculty/sections/section%2F1/grade-corrections");
    expect(options).toMatchObject({ method: "POST", accessToken: "access" });
    const body = options!.body as FormData;
    expect([...body.keys()]).toEqual(["student_id", "proposed_mark", "reason", "grading_sheet"]);
    expect(body.get("grading_sheet")).toEqual(file);
  });
  it("AC-FAC-002.2/.3: sends an explicit decision action and loaded version, with trimmed remarks", async () => {
    const http = client();
    http.request.mockResolvedValue({ ...row, state: "PENDING_DEAN", version: 2 });
    await createCorrectionApi(http, "admin", correctionCodec).decide("access", "request/1", {
      action: "ENDORSE",
      version: 1,
      remarks: "  Verified  ",
    });
    expect(http.request.mock.calls[0]).toEqual([
      "/admin/grade-corrections/request%2F1",
      expect.objectContaining({
        method: "PATCH",
        accessToken: "access",
        body: { action: "ENDORSE", version: 1, remarks: "Verified" },
      }),
    ]);
  });
  it("AC-FAC-002.5: parsed approval actors prevent the same actor taking another step", () => {
    const item = correctionCodec.detail({
      ...row,
      state: "PENDING_DEAN",
      chairApprovedBy: "reviewer",
    });
    expect(canReviewCorrection("dean", "reviewer", item)).toBe(false);
    expect(canReviewCorrection("dean", "other", item)).toBe(true);
  });
  it("AC-FAC-002.6: returns conflicts once, without replaying the PATCH", async () => {
    const http = client();
    const failure = new ApiError(409, "APPROVAL_OUT_OF_ORDER");
    http.request.mockRejectedValue(failure);
    await expect(
      createCorrectionApi(http, "admin", correctionCodec).decide("access", "one", {
        action: "COMMIT",
        version: 1,
        remarks: "",
      }),
    ).rejects.toBe(failure);
    expect(http.request).toHaveBeenCalledTimes(1);
  });
  it("refuses cross-portal operations before sending requests", async () => {
    const http = client();
    const faculty = createCorrectionApi(http, "faculty", correctionCodec);
    const admin = createCorrectionApi(http, "admin", correctionCodec);
    await expect(
      faculty.decide("access", "one", { action: "COMMIT", version: 1, remarks: "" }),
    ).rejects.toHaveProperty("status", 403);
    await expect(admin.sections("access")).rejects.toHaveProperty("status", 403);
    await expect(admin.students("access", "section-1")).rejects.toHaveProperty("status", 403);
    expect(http.request).not.toHaveBeenCalled();
  });
  it("rejects malformed pagination rather than leaving requests out", async () => {
    const http = client();
    http.request.mockResolvedValue(page([], 0, 10));
    await expect(
      createCorrectionApi(http, "admin", correctionCodec).list("access"),
    ).rejects.toHaveProperty("code", "INVALID_RESPONSE");
  });
  it.each(["1.01", "3.25", "4.00", "4.75", "PASS", "FAIL"])(
    "AC-FAC-002.1: rejects %s outside the documented mark set",
    (value) => expect(correctionMark(value)).toBeNull(),
  );
});
