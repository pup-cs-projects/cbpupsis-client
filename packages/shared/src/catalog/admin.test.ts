import { createApiClient } from "../api/client";
import { afterEach, expect, it, vi } from "vitest";
import { createAdminCatalogApi } from "./admin";
afterEach(() => vi.unstubAllGlobals());
it("AC-ENRL-005.7 / AC-ENRL-005.8: substitution and degree progress use role-prefixed routes and documented bodies", async () => {
  const studentId = "student/one";
  const progress = { studentId, completedUnits: "3.0", totalUnitsRequired: "120.0", courses: [] };
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          originalCourseId: "course-1",
          substituteCourseId: "course-2",
          studentIds: [studentId],
          degreeProgress: [progress],
        }),
      ),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify(progress)));
  vi.stubGlobal("fetch", fetch);
  const api = createAdminCatalogApi(createApiClient("https://api.example.com/api/v1"));
  const input = {
    originalCourseId: "course-1",
    substituteCourseId: "course-2",
    studentIds: [studentId],
  };
  await api.approveSubstitution("token", input);
  expect(await api.degreeProgress("token", studentId)).toMatchObject({
    completedUnits: "3.0",
    courses: [],
  });
  expect(fetch.mock.calls[0]![0]).toBe(
    "https://api.example.com/api/v1/admin/catalog/substitutions",
  );
  expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual(input);
  expect(fetch.mock.calls[1]![0]).toBe(
    "https://api.example.com/api/v1/admin/catalog/students/student%2Fone/degree-progress",
  );
  expect(new Headers(fetch.mock.calls[1]![1].headers).get("Authorization")).toBe("Bearer token");
});
