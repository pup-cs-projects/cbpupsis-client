import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../api/client";
import { createStudentDashboardApi } from "./student";

const api = createStudentDashboardApi(createApiClient("http://api.test/api/v1"));

function json(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// The shape GET /student/me/dashboard returns, including sections this client ignores.
function dashboard(data: Record<string, unknown> = {}) {
  return {
    status: "success",
    data: {
      student: {
        student_number: "2021-00456-MN-0",
        name: "Juan A. Dela Cruz",
        programme: "BS Computer Science",
        year_level: 3,
        enrollment_status: "ENROLLED",
        avatar_url: null,
      },
      current_term: { id: "t1", academic_year: "2026-2027", semester: "first", is_current: true },
      holds: [],
      standing: { value: "GOOD", unit_reduction: 0 },
      enrollment: { enrolled_units: "21.0", effective_ceiling: "24.0", prescribed_load: "21.0" },
      periods: [],
      announcements: [
        {
          id: "a1",
          title: "Enrollment opens",
          body: "Enrollment for the first semester opens on August 1.",
          category: "ACADEMIC",
          published_at: "2026-07-20T01:00:00Z",
          expires_at: null,
          is_pinned: true,
        },
      ],
      events: [
        {
          id: "e1",
          title: "Start of classes",
          starts_at: "2026-08-17T00:00:00+08:00",
          ends_at: "2026-08-17T23:59:00+08:00",
          is_multi_day: false,
          category: "ACADEMIC_CALENDAR",
          description: null,
        },
      ],
      recent_activity: [
        {
          id: "r1",
          occurred_at: "2026-07-21T09:15:00+08:00",
          type: "LOGIN_FAILED",
          severity: "WARNING",
          description: "Failed sign-in attempt",
        },
      ],
      empty_states: { announcements: null, events: null, recent_activity: null },
      ...data,
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("student dashboard api", () => {
  it("reads the caller's own dashboard with the bearer token", async () => {
    const fetchMock = json(dashboard());

    const result = await api.me("tok");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/api/v1/student/me/dashboard");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok");
    expect(result.student).toEqual({
      studentNumber: "2021-00456-MN-0",
      name: "Juan A. Dela Cruz",
      programme: "BS Computer Science",
      yearLevel: 3,
      enrollmentStatus: "ENROLLED",
      avatarUrl: null,
    });
    expect(result.currentTerm).toEqual({ id: "t1", academicYear: "2026-2027", semester: "first" });
    expect(result.announcements[0]).toMatchObject({ id: "a1", isPinned: true });
    expect(result.events[0]).toMatchObject({ id: "e1", isMultiDay: false, description: null });
    expect(result.recentActivity[0]).toMatchObject({ type: "LOGIN_FAILED", severity: "warning" });
  });

  it("treats the API's empty fallbacks as missing, never as a name or a term", async () => {
    json(
      dashboard({
        student: {
          student_number: "2021-00456-MN-0",
          // No name on record: the API falls back to the student number.
          name: "2021-00456-MN-0",
          programme: "",
          year_level: 1,
          enrollment_status: "NOT_ENROLLED",
        },
        current_term: { id: "t0", academic_year: "", semester: "", is_current: true },
      }),
    );

    const result = await api.me("tok");

    expect(result.student.name).toBeNull();
    expect(result.student.programme).toBeNull();
    expect(result.currentTerm).toBeNull();
  });

  it("passes the API's empty-state messages through", async () => {
    json(
      dashboard({
        announcements: [],
        empty_states: {
          announcements: "No announcements at this time.",
          events: null,
          recent_activity: null,
        },
      }),
    );

    const result = await api.me("tok");

    expect(result.announcements).toEqual([]);
    expect(result.emptyStates).toEqual({
      announcements: "No announcements at this time.",
      events: null,
      recentActivity: null,
    });
  });

  it("fails at the boundary when the response drifts", async () => {
    json(
      dashboard({
        recent_activity: [
          { id: "r1", occurred_at: "x", type: "T", severity: "LOUD", description: "d" },
        ],
      }),
    );

    await expect(api.me("tok")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("fails at the boundary when the envelope has no data", async () => {
    json({ status: "success" });

    await expect(api.me("tok")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
});
