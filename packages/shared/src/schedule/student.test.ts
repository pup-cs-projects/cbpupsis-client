import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../api/client";
import { createStudentScheduleApi } from "./student";

const root = "http://localhost:8000/api/v1";
const status = {
  enabled: true,
  connected: true,
  disconnecting: false,
  last_sync_at: "2026-11-11T01:00:00Z",
  next_sync_at: "2026-11-11T02:00:00Z",
  last_error: null,
  targets: [{ year: "2026-2027", semester: "first", provisioned: false }],
};
function reply(body: unknown, responseStatus = 200) {
  const fetch = vi.fn(
    async (_input: string, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        status: responseStatus,
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

describe("student Google Calendar API boundary", () => {
  it("AC-STU-005.9: maps documented snake_case fields and discards credentials/Google IDs", async () => {
    const fetch = reply({ ...status, google_id: "not-public", refresh_token: "not-public" });
    const api = createStudentScheduleApi(createApiClient(root));
    const result = await api.googleCalendar.status("student-access");
    expect(fetch.mock.calls[0]?.[0]).toBe(root + "/student/schedule/google-calendar");
    expect(result).toEqual({
      enabled: true,
      connected: true,
      disconnecting: false,
      lastSyncAt: status.last_sync_at,
      nextSyncAt: status.next_sync_at,
      lastError: null,
      targets: status.targets,
    });
    expect(JSON.stringify(result)).not.toContain("not-public");
  });
  it("AC-STU-005.10: accepts a disabled connection with documented defaults", async () => {
    reply({ enabled: false });
    const api = createStudentScheduleApi(createApiClient(root));
    expect(await api.googleCalendar.status("access")).toEqual({
      enabled: false,
      connected: false,
      disconnecting: false,
      lastSyncAt: null,
      nextSyncAt: null,
      lastError: null,
      targets: [],
    });
  });
  it("AC-STU-005.1: sends {} or a complete selector pair and validates the Google URL", async () => {
    const fetch = reply({
      authorization_url: "https://accounts.google.com/o/oauth2/v2/auth?state=private",
    });
    const api = createStudentScheduleApi(createApiClient(root));
    expect((await api.googleCalendar.authorize("access")).expiresIn).toBe(600);
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({});
    await api.googleCalendar.authorize("access", { year: "2026-2027", semester: "first" });
    expect(JSON.parse(fetch.mock.calls[1]![1]!.body as string)).toEqual({
      year: "2026-2027",
      semester: "first",
    });
  });
  it.each([
    "javascript:alert(1)",
    "https://evil.example/oauth",
    "https://accounts.google.com.evil.example/o/oauth2/auth",
  ])("AC-STU-005.1: unsafe authorization URL is refused (%s)", async (url) => {
    reply({ authorization_url: url });
    const api = createStudentScheduleApi(createApiClient(root));
    await expect(api.googleCalendar.authorize("access")).rejects.toHaveProperty(
      "code",
      "INVALID_RESPONSE",
    );
  });
  it("AC-STU-005.1: callback forwards only state/code using an authenticated POST", async () => {
    const fetch = reply(status);
    const api = createStudentScheduleApi(createApiClient(root));
    await api.googleCalendar.callback("access", {
      state: "valid-calendar-state-for-test-0001",
      code: "code+once%2F",
    });
    expect(fetch.mock.calls[0]![0]).toBe(root + "/student/schedule/google-calendar/callback");
    const init = fetch.mock.calls[0]![1]!;
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer access");
    expect(JSON.parse(init.body as string)).toEqual({
      state: "valid-calendar-state-for-test-0001",
      code: "code+once%2F",
    });
  });
  it("AC-STU-005.4, AC-STU-005.6: sync/delete accept queued 202 connection responses", async () => {
    const fetch = reply(status, 202);
    const api = createStudentScheduleApi(createApiClient(root));
    await api.googleCalendar.sync("access", { year: "2026-2027", semester: "first" });
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
      year: "2026-2027",
      semester: "first",
    });
    await api.googleCalendar.disconnect("access");
    expect(fetch.mock.calls[1]![1]!.method).toBe("DELETE");
    expect(fetch.mock.calls[1]![1]!.body).toBeUndefined();
  });
  it("AC-STU-005.9: invalid status timestamps fail at the boundary", async () => {
    reply({ ...status, last_sync_at: "not-a-date" });
    const api = createStudentScheduleApi(createApiClient(root));
    await expect(api.googleCalendar.status("access")).rejects.toHaveProperty(
      "code",
      "INVALID_RESPONSE",
    );
  });
  it.each([404, 503])(
    "AC-STU-005.15: a rejected API request (%s) never retries another namespace",
    async (httpStatus) => {
      const fetch = reply({ code: "GOOGLE_CALENDAR_UNAVAILABLE" }, httpStatus);
      const api = createStudentScheduleApi(createApiClient(root));
      await expect(api.googleCalendar.status("access")).rejects.toHaveProperty(
        "code",
        "GOOGLE_CALENDAR_UNAVAILABLE",
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    },
  );
});

it("AC-STU-005.15: callback deadline exceeds the backend's 25-second provider timeout", async () => {
  const timeout = vi.spyOn(AbortSignal, "timeout");
  reply(status);
  const api = createStudentScheduleApi(createApiClient(root));
  await api.googleCalendar.callback("access", {
    state: "valid-calendar-state-for-test-0001",
    code: "new-code",
  });
  expect(timeout).toHaveBeenCalledWith(35_000);
});

describe.each(["/student/schedule", "/students/me/schedule"] as const)(
  "configured schedule namespace %s",
  (schedulePath) => {
    it("uses the selected namespace for schedule reads and both export formats", async () => {
      const fetch = reply({
        term: { year: "2026-2027", semester: "first" },
        courses: [],
        total_credits: "0.0",
        state: "notEnrolled",
        message: "No enrolled courses.",
      });
      const api = createStudentScheduleApi(createApiClient(root), schedulePath);
      expect((await api.current("student-access")).state).toBe("notEnrolled");
      for (const format of ["pdf", "ics"] as const) {
        fetch.mockResolvedValueOnce(new Response("schedule-file"));
        const file = await api.export("student-access", format);
        expect(await file.blob.text()).toBe("schedule-file");
        expect(file.filename).toBe(`course-schedule.${format}`);
      }
      expect(fetch.mock.calls.map(([url]) => url)).toEqual([
        root + schedulePath,
        `${root}${schedulePath}/export?format=pdf`,
        `${root}${schedulePath}/export?format=ics`,
      ]);
      for (const [, init] of fetch.mock.calls) {
        expect(init?.method).toBe("GET");
        expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer student-access");
      }
    });

    it("keeps status, consent, callback, sync and disconnect on one namespace", async () => {
      const fetch = reply(status);
      const api = createStudentScheduleApi(createApiClient(root), schedulePath).googleCalendar;
      const calendarPath = root + schedulePath + "/google-calendar";
      const term = { year: "2026-2027", semester: "first" };
      await api.status("student-access");
      fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authorization_url: "https://accounts.google.com/o/oauth2/v2/auth?state=private",
            expires_in: 600,
          }),
        ),
      );
      await api.authorize("student-access", term);
      await api.callback("student-access", {
        state: "valid-calendar-state-for-test-0001",
        code: "single-use-code",
      });
      await api.sync("student-access", term);
      await api.disconnect("student-access");
      expect(fetch.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
        [calendarPath, "GET"],
        [calendarPath + "/authorization", "POST"],
        [calendarPath + "/callback", "POST"],
        [calendarPath + "/sync", "POST"],
        [calendarPath, "DELETE"],
      ]);
      expect(JSON.parse(fetch.mock.calls[1]![1]!.body as string)).toEqual(term);
      expect(JSON.parse(fetch.mock.calls[2]![1]!.body as string)).toEqual({
        state: "valid-calendar-state-for-test-0001",
        code: "single-use-code",
      });
      expect(JSON.parse(fetch.mock.calls[3]![1]!.body as string)).toEqual(term);
      for (const [, init] of fetch.mock.calls) {
        expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer student-access");
        expect(init?.credentials).toBe("include");
      }
    });
  },
);
