import { ApiError } from "../api/errors";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "../api/client";
import {
  GradeValidationError,
  createFacultyGradesApi,
  createIncompleteReviewApi,
  normalizeGrade,
  type FacultyGradesContract,
  type IncompleteReviewContract,
} from "./faculty";

afterEach(() => vi.restoreAllMocks());
const section = {
  id: "section-1",
  courseCode: "COMP 016",
  courseTitle: "Web Development",
  sectionName: "BSCS 2-1",
  termLabel: "2026–2027",
  studentCount: 0,
};
const sheet = {
  section,
  state: "DRAFT" as const,
  version: 1,
  savedAt: null,
  finalizedAt: null,
  rows: [],
};
const contract: FacultyGradesContract = {
  sections: () => [section],
  sheet: () => sheet,
  deadline: () => ({ deadline: null, passed: false }),
  finalized: () => ({
    state: "FINAL",
    version: 2,
    finalizedAt: null,
    recordsCommitted: 0,
    notificationsQueued: 0,
  }),
  incompletes: () => [],
  completion: () => ({ id: "completion-1", state: "PENDING_DEAN" }),
  draftBody: (input) => ({ encodedDraft: input }),
  finalizeBody: (version) => ({ encodedVersion: version }),
  completionBody: ({ mark, form }) => {
    const data = new FormData();
    data.append("codecMark", mark);
    data.append("codecFile", form);
    return data;
  },
};
function client() {
  return {
    request: vi.fn<ApiClient["request"]>().mockResolvedValue({}),
    requestBlob: vi.fn<ApiClient["requestBlob"]>(),
  };
}
describe("Faculty grading integration boundary", () => {
  it("does not invent a wire contract or send requests before the codec is configured", async () => {
    const http = client();
    await expect(createFacultyGradesApi(http).sections("access")).rejects.toHaveProperty(
      "code",
      "GRADING_NOT_CONFIGURED",
    );
    await expect(createIncompleteReviewApi(http).list("access")).rejects.toHaveProperty(
      "code",
      "GRADING_NOT_CONFIGURED",
    );
    expect(http.request).not.toHaveBeenCalled();
  });
  it("uses only faculty-prefixed section routes and includes versions through the codec", async () => {
    const http = client();
    const api = createFacultyGradesApi(http, contract);
    await api.sections("access");
    await api.sheet("access", "section/one");
    await api.deadline("access", "section/one");
    await api.saveDraft("access", "section/one", { version: 4, grades: [] });
    await api.finalize("access", "section/one", 5);
    expect(http.request.mock.calls.map(([route, options]) => [route, options?.method])).toEqual([
      ["/faculty/sections", "GET"],
      ["/faculty/sections/section%2Fone/grades", "GET"],
      ["/faculty/sections/section%2Fone/grade-deadline", "GET"],
      ["/faculty/sections/section%2Fone/grades/draft", "PUT"],
      ["/faculty/sections/section%2Fone/grades/finalize", "POST"],
    ]);
    expect(http.request.mock.calls[3]?.[1]?.body).toEqual({
      encodedDraft: { version: 4, grades: [] },
    });
    expect(http.request.mock.calls[4]?.[1]?.body).toEqual({ encodedVersion: 5 });
    for (const [, options] of http.request.mock.calls) expect(options?.accessToken).toBe("access");
  });
  it("passes multipart field encoding to the final backend codec", async () => {
    const http = client();
    const api = createFacultyGradesApi(http, contract);
    const form = new File(["form"], "form.pdf");
    await api.incompletes("access");
    await api.complete("access", "inc/one", { mark: "2.00", form });
    expect(http.request.mock.calls[0]?.[0]).toBe("/faculty/incompletes");
    expect(http.request.mock.calls[1]?.[0]).toBe("/faculty/incompletes/inc%2Fone/completion");
    const body = http.request.mock.calls[1]?.[1]?.body as FormData;
    expect(body.get("codecMark")).toBe("2.00");
    expect(body.get("codecFile")).toEqual(form);
  });
  it("uses the admin prefix for all Dean review operations without automatic mutation replay", async () => {
    const http = client();
    const detail = {
      id: "completion-1",
      version: 2,
      studentName: "Ana",
      studentNumber: "2026-001",
      courseCode: "COMP 016",
      sectionName: "BSCS 2-1",
      proposedMark: "2.00",
      filedAt: "2026-11-12T00:00:00Z",
      state: "PENDING_DEAN" as const,
      formName: "form.pdf",
      formUrl: null,
      remarks: null,
    };
    const codec: IncompleteReviewContract = {
      list: () => [detail],
      detail: () => detail,
      decisionBody: (input) => input,
    };
    const api = createIncompleteReviewApi(http, codec);
    await api.list("access");
    await api.detail("access", "one/two");
    await api.decide("access", "one/two", {
      version: 2,
      decision: "REJECT",
      remarks: "Needs signature",
    });
    expect(http.request.mock.calls.map(([route, options]) => [route, options?.method])).toEqual([
      ["/admin/incomplete-completions", "GET"],
      ["/admin/incomplete-completions/one%2Ftwo", "GET"],
      ["/admin/incomplete-completions/one%2Ftwo", "PATCH"],
    ]);
    expect(http.request).toHaveBeenCalledTimes(3);
  });
  it.each(["0.99", "5.01", "1e0", "1.234", "", "NaN"])("refuses invalid marks: %s", (mark) =>
    expect(normalizeGrade(mark)).toBeNull(),
  );
  it("normalizes numeric/Inc marks and restricts completion marks to a passing range", () => {
    expect(normalizeGrade(" inc ")).toBe("INC");
    expect(normalizeGrade("2.5")).toBe("2.50");
    expect(normalizeGrade("3.01", true)).toBeNull();
    expect(normalizeGrade("INC", true)).toBeNull();
    expect(normalizeGrade("3", true)).toBe("3.00");
  });
});

it("normalizes backend row errors through the configured codec without retrying", async () => {
  const http = client();
  const error = new ApiError(422, "VALIDATION_ERROR");
  http.request.mockRejectedValueOnce(error);
  const normalizeError = vi.fn(
    () => new GradeValidationError({ "student-1": "Correct this mark." }),
  );
  const api = createFacultyGradesApi(http, { ...contract, normalizeError });
  await expect(
    api.saveDraft("access", "section-1", { version: 1, grades: [] }),
  ).rejects.toHaveProperty("fields", { "student-1": "Correct this mark." });
  expect(normalizeError).toHaveBeenCalledWith(error);
  expect(http.request).toHaveBeenCalledTimes(1);
});
it("retains unrecognized API failures when a codec has no special error mapping", async () => {
  const http = client();
  const error = new ApiError(409, "VERSION_CONFLICT");
  http.request.mockRejectedValueOnce(error);
  await expect(
    createFacultyGradesApi(http, contract).saveDraft("access", "section-1", {
      version: 1,
      grades: [],
    }),
  ).rejects.toBe(error);
  expect(http.request).toHaveBeenCalledTimes(1);
});
