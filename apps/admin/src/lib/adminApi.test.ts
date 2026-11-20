import { ApiError, createApiClient } from "@cbpupsis/shared/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  auditWire,
  courseWire,
  notificationWire,
  pageWire,
  termId,
  userWire,
} from "../test/adminApiFixtures";
import {
  adminApiMessage,
  createAdminOperationsApi,
  type CourseInput,
  type SectionInput,
} from "./adminApi";

afterEach(() => vi.unstubAllGlobals());
const root = "http://localhost:8003/api/v1";
const auth = {
  authorized: async <T>(call: (token: string) => Promise<T>) => call("synthetic-admin"),
};
function setup(body: unknown, status = 200, usersPath: "/admin/users" = "/admin/users") {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation(
      async () => new Response(status === 204 ? null : JSON.stringify(body), { status }),
    );
  vi.stubGlobal("fetch", fetch);
  return { api: createAdminOperationsApi(createApiClient(root), auth, usersPath), fetch };
}
const input: CourseInput = {
  courseCode: "COMP 001",
  title: "Introduction to Computing",
  description: null,
  lectureUnits: "3.0",
  labUnits: "0.0",
  gradingMode: "NUMERIC",
  isActive: true,
  prerequisiteIds: [],
  corequisiteIds: [],
};
describe("admin live API contracts", () => {
  it("sends the authenticated scoped catalog request with server pagination", async () => {
    const { api, fetch } = setup(pageWire([courseWire], 21));
    expect((await api.courses("COMP & 001", 0)).total).toBe(21);
    const [url, options] = fetch.mock.calls[0]!;
    expect(String(url)).toBe(root + "/admin/catalog/courses?search=COMP+%26+001&limit=20&offset=0");
    expect(options).toMatchObject({ method: "GET", credentials: "include" });
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer synthetic-admin");
  });
  it("creates and updates courses with the documented camelCase body", async () => {
    const { api, fetch } = setup(courseWire);
    await api.saveCourse(input);
    await api.saveCourse(input, "course/one");
    expect(fetch.mock.calls.map(([url, options]) => [url, options?.method])).toEqual([
      [root + "/admin/catalog/courses", "POST"],
      [root + "/admin/catalog/courses/course%2Fone", "PATCH"],
    ]);
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual(input);
  });
  it("preserves existing section assignment and meetings on a partial update", async () => {
    const { api, fetch } = setup({ id: "section-1", sectionName: "BSCS 1-1", capacity: 40 });
    const section: SectionInput = {
      courseId: courseWire.id,
      sectionName: "BSCS 1-1",
      capacity: 40,
      room: null,
      meetings: [],
      replaceMeetings: false,
    };
    await api.saveSection(section, "section-1");
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
      sectionName: "BSCS 1-1",
      capacity: 40,
    });
    await api.saveSection({ ...section, replaceMeetings: true }, "section-1");
    expect(JSON.parse(fetch.mock.calls[1]![1]!.body as string)).toEqual({
      sectionName: "BSCS 1-1",
      capacity: 40,
      meetings: [],
    });
    await api.saveSection(section);
    expect(JSON.parse(fetch.mock.calls[2]![1]!.body as string)).toMatchObject({
      courseId: courseWire.id,
      room: null,
      meetings: [],
    });
  });
  it("publishes and deletes only the identified curriculum version", async () => {
    const { api, fetch } = setup({ id: "version-1", programCode: "BSCS", curriculumYear: "2026" });
    const body = {
      effectiveAdmissionYear: 2026,
      curriculumYear: "2026",
      courses: [
        { courseCode: "COMP 001", yearLevel: 1, semester: "First Semester", courseType: "core" },
      ],
    };
    await api.publishCurriculum("BSCS", body);
    await api.deleteCurriculum("BSCS", "version/one");
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual(body);
    expect(fetch.mock.calls[1]![0]).toBe(
      root + "/admin/catalog/curricula/BSCS/versions/version%2Fone",
    );
    expect(fetch.mock.calls[1]![1]?.method).toBe("DELETE");
  });
  it("reports and exports use the same explicit term and filters", async () => {
    const { api, fetch } = setup({ rows: [{ group: "BSCS", count: 2 }], total: 2 });
    const filters = { termId, groupBy: "program", programCode: "BSCS" } as const;
    expect((await api.report(filters)).total).toBe(2);
    await api.exportReport(filters, "pdf");
    const urls = fetch.mock.calls.map(([url]) => new URL(String(url)));
    expect(urls[0]!.searchParams.get("termId")).toBe(termId);
    expect(urls[1]!.searchParams.get("termId")).toBe(termId);
    expect(urls[1]!.searchParams.get("format")).toBe("pdf");
    expect(urls[1]!.pathname).toBe("/api/v1/admin/reports/enrollment/export");
    expect(fetch.mock.calls[1]![1]?.method).toBe("GET");
  });
  it("notification reads discard opaque payloads; mutations use documented routes", async () => {
    const { api, fetch } = setup(pageWire([notificationWire]));
    const result = await api.notifications();
    expect(JSON.stringify(result)).not.toContain("not-for-cache");
    fetch.mockResolvedValueOnce(new Response(JSON.stringify(notificationWire)));
    await api.markRead("notification/one");
    await api.markAllRead();
    expect(fetch.mock.calls[1]![0]).toBe(root + "/notifications/notification%2Fone/read");
    expect(fetch.mock.calls[2]![0]).toBe(root + "/notifications/read-all");
    expect(fetch.mock.calls[2]![1]?.body).toBeUndefined();
  });
  it("maps preferences and sends snake_case notification fields without editable", async () => {
    const { api, fetch } = setup([
      { notification_type: "security.sign_in", channel: "email", enabled: true, editable: false },
    ]);
    const preferences = await api.preferences();
    expect(preferences[0]!.editable).toBe(false);
    await api.setPreference({ ...preferences[0]!, enabled: false });
    expect(JSON.parse(fetch.mock.calls[1]![1]!.body as string)).toEqual({
      notification_type: "security.sign_in",
      channel: "email",
      enabled: false,
    });
  });
  it("keeps raw audit payloads and before/after states out of caches", async () => {
    const { api } = setup(pageWire([auditWire]));
    const result = await api.audit();
    expect(result.items[0]).toMatchObject({ action: "catalog.course_updated", actor: null });
    expect(JSON.stringify(result)).not.toContain("not-for-cache");
    expect(result.items[0]).not.toHaveProperty("payload");
  });
  it.each(["/admin/users"] as const)(
    "uses only the configured user namespace %s",
    async (usersPath) => {
      const { api, fetch } = setup(pageWire([userWire]), 200, usersPath);
      await api.users("inactive", 20);
      fetch.mockResolvedValueOnce(new Response(JSON.stringify({ ...userWire, is_active: false })));
      expect((await api.setUserActive(userWire.id, false)).active).toBe(false);
      expect(String(fetch.mock.calls[0]![0])).toContain(
        root + usersPath + "?is_active=false&limit=20&offset=20",
      );
      expect(fetch.mock.calls[1]![0]).toBe(root + usersPath + "/" + userWire.id + "/deactivate");
    },
  );
  it("does not fall back to samples or another namespace after permission refusal", async () => {
    const { api, fetch } = setup({ detail: "private permission details" }, 403);
    await expect(api.users("all")).rejects.toMatchObject({ status: 403 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      adminApiMessage(new ApiError(403, undefined, { detail: "private permission details" })),
    ).not.toContain("private");
  });
  it("rejects inconsistent reports and invalid dates at the boundary", async () => {
    const { api, fetch } = setup({ rows: [{ group: "BSCS", count: 2 }], total: 1 });
    await expect(api.report({ termId, groupBy: "program" })).rejects.toHaveProperty(
      "code",
      "INVALID_RESPONSE",
    );
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify(pageWire([{ ...notificationWire, created_at: "invalid" }]))),
    );
    await expect(api.notifications()).rejects.toHaveProperty("code", "INVALID_RESPONSE");
  });
});
