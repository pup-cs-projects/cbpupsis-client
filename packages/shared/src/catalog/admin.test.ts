import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import { createAdminCatalogApi } from "./admin";

const api = createAdminCatalogApi(createApiClient("http://api.test/api/v1"));
const courseId = "10000000-0000-4000-8000-000000000001";

const course = {
  id: courseId,
  code: "CS101",
  courseCode: "CS101",
  title: "Programming 1",
  description: null,
  department: "Computer Science",
  college: "CCIS",
  units: "3",
  lectureUnits: "2",
  labUnits: "1",
  lectureHours: 2,
  labHours: 3,
  totalUnits: "3",
  gradingMode: "NUMERIC",
  termOffered: "First Semester",
  isActive: true,
  prerequisiteIds: [],
  corequisiteIds: [],
  prerequisites: [],
  corequisites: [],
};

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sent(fetchMock: ReturnType<typeof respond>) {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, method: init.method, body: init.body ? JSON.parse(String(init.body)) : undefined };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin catalog api", () => {
  it("lists courses in scope with search and paging", async () => {
    const fetchMock = respond(200, { items: [course], total: 1, limit: 25, offset: 0 });
    const page = await api.listCourses("token", { search: " CS1 ", limit: 25, offset: 0 });
    expect(sent(fetchMock).url).toBe(
      "http://api.test/api/v1/admin/catalog/courses?limit=25&offset=0&search=CS1",
    );
    expect(page.items[0]).toMatchObject({ courseCode: "CS101", totalUnits: "3" });
  });

  it("refuses a course page that drifted from the contract", async () => {
    respond(200, { items: [{ id: courseId }], total: 1, limit: 25, offset: 0 });
    await expect(
      api.listCourses("token", { search: "", limit: 25, offset: 0 }),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("AC-ENRL-005.2: carries the cycle the API names", async () => {
    respond(422, {
      code: "CATALOG_PREREQUISITE_CYCLE",
      message: "Prerequisite or co-requisite configuration forms a cycle: CS101 -> CS101.",
      detail: "Prerequisite or co-requisite configuration forms a cycle: CS101 -> CS101.",
      details: { cycle: ["CS101", "CS101"] },
    });
    const error = await api
      .updateCourse("token", courseId, { prerequisiteIds: [courseId] })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).details).toEqual({ cycle: ["CS101", "CS101"] });
  });

  it("deletes a curriculum version by id", async () => {
    const fetchMock = respond(204, null);
    await api.deleteCurriculumVersion("token", courseId);
    expect(sent(fetchMock)).toMatchObject({
      url: `http://api.test/api/v1/admin/catalog/curricula/versions/${courseId}`,
      method: "DELETE",
    });
  });

  it("parses a created section with its seats left", async () => {
    const fetchMock = respond(201, {
      id: courseId,
      courseId,
      academicTermId: courseId,
      facultyId: null,
      sectionName: "BSCS 1-1",
      capacity: 40,
      enrolled: 0,
      seatsLeft: 40,
      room: "S501",
      status: "open",
      meetings: [],
    });
    const section = await api.createSection("token", {
      courseId,
      sectionName: "BSCS 1-1",
      facultyId: null,
      capacity: 40,
      room: "S501",
      meetings: [],
    });
    expect(sent(fetchMock).body).toMatchObject({ courseId, capacity: 40 });
    expect(section.seatsLeft).toBe(40);
  });
});
