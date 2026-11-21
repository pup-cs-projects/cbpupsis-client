import type { ApiClient } from "../api/client";
import * as p from "../api/parse";

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
export interface FacultySection {
  id: string;
  sectionName: string;
  capacity: number;
  status: string;
}
export const ENROLLMENT_STATUSES = ["ENROLLED", "DROPPED", "WITHDRAWN"] as const;
export const GRADE_STATUSES = ["PENDING", "DRAFT", "SUBMITTED", "INC"] as const;
export interface RosterFilters {
  enrollmentStatus?: (typeof ENROLLMENT_STATUSES)[number];
  gradeStatus?: (typeof GRADE_STATUSES)[number];
}
export interface RosterEntry {
  studentId: string;
  studentNumber: string;
  name: string;
  email: string;
  enrollmentStatus: string;
  gradeStatus: string;
  addDropStatus: string;
}
export interface FacultyRoster extends FacultySection {
  roster: RosterEntry[];
  total: number;
  limit: number;
  offset: number;
}
export interface TeachingStudent {
  name: string;
  studentNumber: string;
  email: string;
  program: string;
  yearLevel: number;
}

export function parsePage<T>(body: unknown, item: (value: unknown) => T): Page<T> {
  const data = p.record(body);
  return {
    items: p.array(data.items).map(item),
    total: p.nonNegativeInteger(data.total),
    limit: p.positiveNumber(data.limit),
    offset: p.nonNegativeInteger(data.offset),
  };
}
export function parseSection(value: unknown): FacultySection {
  const row = p.record(value);
  return {
    id: p.string(row.id),
    sectionName: p.string(row.section_name),
    capacity: p.nonNegativeInteger(row.capacity),
    status: p.string(row.status),
  };
}
function query(filters: RosterFilters, paging?: { limit: number; offset: number }) {
  const params = new URLSearchParams();
  if (filters.enrollmentStatus) params.set("enrollmentStatus", filters.enrollmentStatus);
  if (filters.gradeStatus) params.set("gradeStatus", filters.gradeStatus);
  if (paging) {
    params.set("limit", String(paging.limit));
    params.set("offset", String(paging.offset));
  }
  return params.size ? `?${params}` : "";
}
const root = "/faculty/sections";
const rosterPath = (id: string) => `${root}/${encodeURIComponent(id)}/roster`;
export function createFacultySectionsApi(client: ApiClient) {
  return {
    async sections(token: string, offset = 0, signal?: AbortSignal) {
      return parsePage(
        await client.request(`${root}?limit=20&offset=${offset}`, {
          method: "GET",
          accessToken: token,
          signal,
        }),
        parseSection,
      );
    },
    async roster(
      token: string,
      id: string,
      filters: RosterFilters,
      offset = 0,
      signal?: AbortSignal,
    ): Promise<FacultyRoster> {
      const data = p.record(
        await client.request(rosterPath(id) + query(filters, { limit: 20, offset }), {
          method: "GET",
          accessToken: token,
          signal,
        }),
      );
      return {
        ...parseSection(data),
        total: p.nonNegativeInteger(data.total),
        limit: p.positiveNumber(data.limit),
        offset: p.nonNegativeInteger(data.offset),
        roster: p.array(data.roster).map((value) => {
          const row = p.record(value);
          return {
            studentId: p.string(row.user_id),
            studentNumber: p.string(row.studentNumber),
            name: p.string(row.name),
            email: p.string(row.email),
            enrollmentStatus: p.oneOf(row.enrollmentStatus, ENROLLMENT_STATUSES),
            gradeStatus: p.oneOf(row.gradeStatus, GRADE_STATUSES),
            addDropStatus: p.oneOf(row.addDropStatus, [
              "NONE",
              "PENDING_ADD",
              "PENDING_DROP",
              "APPROVED_ADD",
              "APPROVED_DROP",
            ]),
          };
        }),
      };
    },
    exportCsv(token: string, id: string, filters: RosterFilters) {
      return client.requestBlob(rosterPath(id) + "/export" + query(filters), {
        method: "GET",
        accessToken: token,
      });
    },
    async student(
      token: string,
      id: string,
      studentId: string,
      signal?: AbortSignal,
    ): Promise<TeachingStudent> {
      const row = p.record(
        await client.request(`${rosterPath(id)}/${encodeURIComponent(studentId)}`, {
          method: "GET",
          accessToken: token,
          signal,
        }),
      );
      return {
        name: p.string(row.name),
        studentNumber: p.string(row.studentNumber),
        email: p.string(row.email),
        program: p.string(row.program),
        yearLevel: p.nonNegativeInteger(row.yearLevel),
      };
    },
  };
}
export type FacultySectionsApi = ReturnType<typeof createFacultySectionsApi>;
