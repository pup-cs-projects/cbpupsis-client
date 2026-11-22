import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../api/client";
import { createStudentGradesApi } from "./student";

const root = "http://localhost:8001/api/v1";

function reply(body: unknown) {
  const fetch = vi.fn(
    async (_input: string, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("student grades API paths (US-STU-004: AC-STU-004.1, .5, .15)", () => {
  it("reads the transcript from /student/transcript with the bearer token", async () => {
    const fetch = reply({
      student: { student_number: "2021-00001-MN-0" },
      terms: [],
      cumulative_gwa: null,
      total_units_earned: "0.0",
    });
    const api = createStudentGradesApi(createApiClient(root));
    const transcript = await api.transcript("student-access");
    expect(transcript).toEqual({
      studentNumber: "2021-00001-MN-0",
      terms: [],
      cumulativeGwa: null,
      totalUnitsEarned: 0,
    });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe(`${root}/student/transcript?limit=100`);
    expect(init?.method).toBe("GET");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer student-access");
  });

  it("reads the current term's standing from /student/grades", async () => {
    const fetch = reply({ term: null, academic_standing: null });
    const api = createStudentGradesApi(createApiClient(root));
    expect(await api.term("student-access")).toEqual({ term: null, academicStanding: null });
    expect(fetch.mock.calls[0]?.[0]).toBe(`${root}/student/grades`);
  });

  it("reads a selected term's standing from /student/grades with its year and semester", async () => {
    const fetch = reply({
      term: { id: "term-1", academic_year: "2025-2026", semester: "second" },
      academic_standing: "Good Standing",
    });
    const api = createStudentGradesApi(createApiClient(root));
    const standing = await api.term("student-access", {
      id: "term-1",
      academicYear: "2025-2026",
      semester: "second",
    });
    expect(standing.academicStanding).toBe("Good Standing");
    expect(fetch.mock.calls[0]?.[0]).toBe(`${root}/student/grades?year=2025-2026&semester=second`);
  });
});
