import { expect, it, vi } from "vitest";
import type { ApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import { createFacultyDashboardApi } from "./faculty";

const section = (id: string) => ({ id, section_name: `BSCS ${id}`, capacity: 40, status: "open" });
const page = (items: unknown[], offset = 0, total = items.length) => ({
  items,
  total,
  offset,
  limit: 20,
});
function sheet(id: string, state = "DRAFT", students = ["u1"]) {
  return {
    sectionId: id,
    sectionName: `BSCS ${id}`,
    courseCode: "COMP 001",
    courseTitle: "Computing",
    state,
    version: 1,
    deadline: "2027-01-15T12:00:00Z",
    deadlinePassed: false,
    submittedAt: null,
    grades: students.map((id) => ({
      studentId: id,
      studentNumber: `S-${id}`,
      studentName: `Student ${id}`,
      finalGrade: null,
      completionDeadline: null,
    })),
  };
}
function client() {
  return {
    request: vi.fn<ApiClient["request"]>(async (path) => {
      if (path.startsWith("/notifications?")) return page([]);
      if (path.startsWith("/faculty/sections?")) return page([section("s1"), section("s2")]);
      return sheet(path.includes("s1") ? "s1" : "s2");
    }),
    requestBlob: vi.fn<ApiClient["requestBlob"]>(),
  };
}
it("counts unique students and draft sections from owned sheets using authenticated read-only calls", async () => {
  const http = client();
  http.request.mockImplementation(async (path) =>
    path.startsWith("/notifications?")
      ? page([])
      : path.startsWith("/faculty/sections?")
        ? page([section("s1"), section("s2")])
        : path.includes("s1")
          ? sheet("s1", "DRAFT", ["u1", "u2"])
          : sheet("s2", "FINAL", ["u1"]),
  );
  const result = await createFacultyDashboardApi(http).overview("access");
  expect(result.studentsTaught).toBe(2);
  expect(result.pendingSections).toBe(1);
  expect(result.sections.map((s) => s.gradeState)).toEqual(["DRAFT", "FINAL"]);
  expect(result.issues).toEqual([]);
  for (const [path, options] of http.request.mock.calls) {
    expect(options?.method).toBe("GET");
    expect(options?.accessToken).toBe("access");
    expect(path).not.toMatch(/announcements|academic-calendar|\/roster|grade-deadline/);
  }
});
it("reads subsequent section pages before reporting totals", async () => {
  const http = client();
  http.request.mockImplementation(async (path) =>
    path.startsWith("/notifications?")
      ? page([])
      : path.startsWith("/faculty/sections?")
        ? path.endsWith("offset=0")
          ? page([section("s1")], 0, 2)
          : page([section("s2")], 1, 2)
        : sheet(path.includes("s1") ? "s1" : "s2"),
  );
  expect((await createFacultyDashboardApi(http).overview("access")).sections).toHaveLength(2);
  expect(
    http.request.mock.calls.some(([path]) => path === "/faculty/sections?limit=20&offset=1"),
  ).toBe(true);
});
it("reports real zeroes for an empty assignment list without requesting grade sheets", async () => {
  const http = client();
  http.request.mockResolvedValue(page([]));
  const result = await createFacultyDashboardApi(http).overview("access");
  expect(result).toMatchObject({
    sections: [],
    studentsTaught: 0,
    pendingSections: 0,
    notifications: [],
  });
  expect(http.request).toHaveBeenCalledTimes(2);
});
it("does not undercount students or pending grades when a sheet fails", async () => {
  const http = client();
  http.request.mockImplementation(async (path) => {
    if (path.includes("s2/grades")) throw new ApiError(503, "SERVICE_UNAVAILABLE");
    return path.startsWith("/notifications?")
      ? page([])
      : path.startsWith("/faculty/sections?")
        ? page([section("s1"), section("s2")])
        : sheet("s1");
  });
  const result = await createFacultyDashboardApi(http).overview("access");
  expect(result.studentsTaught).toBeNull();
  expect(result.pendingSections).toBeNull();
  expect(result.sections[1]?.gradeState).toBeNull();
  expect(result.issues).toHaveLength(1);
});
it("keeps sections available when notifications fail and does not claim the feed is empty", async () => {
  const http = client();
  http.request.mockImplementation(async (path) => {
    if (path.startsWith("/notifications?")) throw new ApiError(503, "SERVICE_UNAVAILABLE");
    return path.startsWith("/faculty/sections?") ? page([section("s1")]) : sheet("s1");
  });
  const result = await createFacultyDashboardApi(http).overview("access");
  expect(result.studentsTaught).toBe(1);
  expect(result.notifications).toBeNull();
  expect(result.issues).toEqual(["Notifications could not be loaded. Refresh to retry."]);
});
it.each(["sections", "notifications", "grades"])(
  "propagates %s session refusal instead of returning partial account data",
  async (source) => {
    const http = client();
    const original = http.request.getMockImplementation()!;
    http.request.mockImplementation(async (path, options) => {
      if (
        (source === "sections" && path.includes("sections?")) ||
        (source === "notifications" && path.includes("notifications?")) ||
        (source === "grades" && path.endsWith("/grades"))
      )
        throw new ApiError(401, "AUTH_SESSION_EXPIRED");
      return original(path, options);
    });
    await expect(createFacultyDashboardApi(http).overview("access")).rejects.toHaveProperty(
      "code",
      "AUTH_SESSION_EXPIRED",
    );
  },
);
it("rejects malformed section pagination instead of silently truncating assignments", async () => {
  const http = client();
  http.request.mockResolvedValue(page([], 0, 20));
  await expect(createFacultyDashboardApi(http).overview("access")).rejects.toHaveProperty(
    "code",
    "INVALID_RESPONSE",
  );
});
it("limits concurrent grade-sheet reads to four", async () => {
  const http = client();
  const pending: ((value: unknown) => void)[] = [];
  let active = 0;
  let maximum = 0;
  http.request.mockImplementation(async (path) => {
    if (path.startsWith("/notifications?")) return page([]);
    if (path.includes("sections?"))
      return page(Array.from({ length: 7 }, (_, i) => section(`s${i}`)));
    active++;
    maximum = Math.max(maximum, active);
    const result = await new Promise((resolve) => pending.push(resolve));
    active--;
    return result;
  });
  const result = createFacultyDashboardApi(http).overview("access");
  await vi.waitFor(() => expect(pending).toHaveLength(4));
  for (let i = 0; i < 7; i++) {
    await vi.waitFor(() => expect(pending[i]).toBeDefined());
    pending[i]!(sheet(`s${i}`));
  }
  expect((await result).sections).toHaveLength(7);
  expect(maximum).toBe(4);
});
it("does not start any reads after the caller cancels", async () => {
  const http = client();
  const controller = new AbortController();
  controller.abort();
  await expect(createFacultyDashboardApi(http).overview("access", controller.signal)).rejects.toBe(
    controller.signal.reason,
  );
  expect(http.request).not.toHaveBeenCalled();
});
