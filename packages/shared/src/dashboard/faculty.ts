import type { ApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import * as p from "../api/parse";
import { facultyGradesContract } from "../grades/facultyContract";
import { createFacultySectionsApi, parsePage, type FacultySection } from "../sections/faculty";

export interface FacultyDashboardSection extends FacultySection {
  courseCode: string | null;
  courseTitle: string | null;
  gradeState: "DRAFT" | "FINAL" | null;
  studentCount: number | null;
  deadline: string | null;
  deadlinePassed: boolean | null;
}
export interface FacultyDashboardNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}
export interface FacultyDashboard {
  sections: FacultyDashboardSection[];
  studentsTaught: number | null;
  pendingSections: number | null;
  notifications: FacultyDashboardNotification[] | null;
  issues: string[];
}
function instant(value: unknown): string {
  const date = p.string(value);
  return Number.isFinite(Date.parse(date)) ? date : p.invalid();
}
function notification(value: unknown): FacultyDashboardNotification {
  const row = p.record(value);
  return {
    id: p.string(row.id),
    title: p.string(row.title),
    body: typeof row.body === "string" ? row.body : p.invalid(),
    createdAt: instant(row.created_at),
    read: row.read_at !== null && row.read_at !== undefined,
  };
}

/** Compose only faculty-owned reads. No aggregate, calendar, or announcements route is assumed. */
export function createFacultyDashboardApi(client: ApiClient) {
  const sectionsApi = createFacultySectionsApi(client);
  async function sections(token: string, signal?: AbortSignal): Promise<FacultySection[]> {
    const found = new Map<string, FacultySection>();
    let offset = 0;
    for (;;) {
      signal?.throwIfAborted();
      const page = await sectionsApi.sections(token, offset, signal);
      if (page.offset !== offset || (!page.items.length && offset < page.total)) p.invalid();
      for (const section of page.items) found.set(section.id, section);
      offset += page.items.length;
      if (offset >= page.total) return [...found.values()];
    }
  }
  async function grade(token: string, section: FacultySection, signal?: AbortSignal) {
    const body = p.record(
      await client.request(`/faculty/sections/${encodeURIComponent(section.id)}/grades`, {
        method: "GET",
        accessToken: token,
        signal,
      }),
    );
    const sheet = facultyGradesContract.sheet(body);
    if (sheet.section.id !== section.id) p.invalid();
    return {
      sheet,
      deadline: instant(body.deadline),
      deadlinePassed: p.boolean(body.deadlinePassed),
    };
  }
  return {
    async overview(token: string, signal?: AbortSignal): Promise<FacultyDashboard> {
      signal?.throwIfAborted();
      const [assigned, notices] = await Promise.allSettled([
        sections(token, signal),
        client
          .request("/notifications?limit=5&offset=0", { method: "GET", accessToken: token, signal })
          .then((body) => parsePage(body, notification).items),
      ]);
      signal?.throwIfAborted();
      for (const result of [assigned, notices])
        if (
          result.status === "rejected" &&
          result.reason instanceof ApiError &&
          result.reason.status === 401
        )
          throw result.reason;
      if (assigned.status === "rejected") throw assigned.reason;
      const issues: string[] = [];
      const results: FacultyDashboardSection[] = [];
      const students = new Set<string>();
      let pending = 0;
      let failed = false;
      let authFailure: ApiError | undefined;
      let cursor = 0;
      // Bound fan-out; the sheet already includes the deadline, so no extra roster/deadline reads.
      await Promise.all(
        Array.from({ length: Math.min(4, assigned.value.length) }, async () => {
          for (;;) {
            signal?.throwIfAborted();
            if (authFailure) return;
            const index = cursor++;
            const section = assigned.value[index];
            if (!section) return;
            try {
              const { sheet, deadline, deadlinePassed } = await grade(token, section, signal);
              for (const student of sheet.rows) students.add(student.studentId);
              if (sheet.state === "DRAFT" && sheet.rows.length > 0) pending++;
              results[index] = {
                ...section,
                courseCode: sheet.section.courseCode || null,
                courseTitle: sheet.section.courseTitle || null,
                gradeState: sheet.state,
                studentCount: sheet.rows.length,
                deadline,
                deadlinePassed,
              };
            } catch (error) {
              signal?.throwIfAborted();
              if (error instanceof ApiError && error.status === 401) {
                authFailure = error;
                return;
              }
              failed = true;
              results[index] = {
                ...section,
                courseCode: null,
                courseTitle: null,
                gradeState: null,
                studentCount: null,
                deadline: null,
                deadlinePassed: null,
              };
            }
          }
        }),
      );
      signal?.throwIfAborted();
      if (authFailure) throw authFailure;
      if (failed)
        issues.push(
          "Some section details could not be loaded. Refresh to retry; student and pending-grade totals are unavailable until all sections load.",
        );
      if (notices.status === "rejected")
        issues.push("Notifications could not be loaded. Refresh to retry.");
      return {
        sections: results,
        studentsTaught: failed ? null : students.size,
        pendingSections: failed ? null : pending,
        notifications: notices.status === "fulfilled" ? notices.value : null,
        issues,
      };
    },
  };
}
