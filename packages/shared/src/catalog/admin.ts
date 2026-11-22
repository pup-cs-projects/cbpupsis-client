import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";

/**
 * Admin catalog endpoints (`/admin/catalog/...`), from the API's docs/openapi.json on staging.
 * Decimal units stay strings, as the API sends them. Only the course list has a GET today:
 * curriculum versions, sections, and substitutions are write-only in the contract.
 */
export interface CatalogCourse {
  id: string;
  courseCode: string;
  title: string;
  description: string | null;
  department: string | null;
  college: string | null;
  lectureUnits: string;
  labUnits: string;
  totalUnits: string;
  termOffered: string | null;
  isActive: boolean;
  prerequisiteIds: string[];
  corequisiteIds: string[];
  prerequisites: string[];
  corequisites: string[];
}

export interface CatalogCoursePage {
  items: CatalogCourse[];
  total: number;
  limit: number;
  offset: number;
}

export interface CatalogCourseInput {
  courseCode: string;
  title: string;
  description: string | null;
  lectureUnits: string;
  labUnits: string;
  termOffered: string | null;
  isActive?: boolean;
  prerequisiteIds: string[];
  corequisiteIds: string[];
}

export interface CurriculumCourseInput {
  courseId: string;
  yearLevel: number;
  semester: string;
}

export interface CurriculumVersionInput {
  effectiveAdmissionYear: number;
  curriculumYear: string | null;
  courses: CurriculumCourseInput[];
}

export interface CurriculumVersion {
  id: string;
  programCode: string;
  curriculumYear: string;
  effectiveAdmissionYear: number | null;
  courseCount: number;
}

export interface SectionMeetingInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  scheduleType: "lecture" | "laboratory";
}

export interface SectionInput {
  courseId: string;
  sectionName: string;
  facultyId: string | null;
  capacity: number;
  room: string | null;
  meetings: SectionMeetingInput[];
}

export interface SectionUpdate {
  capacity?: number;
  room?: string | null;
  facultyId?: string | null;
}

export interface CatalogSection {
  id: string;
  courseId: string;
  academicTermId: string;
  facultyId: string | null;
  sectionName: string;
  capacity: number;
  enrolled: number;
  seatsLeft: number;
  room: string | null;
  status: string;
}

export interface SubstitutionInput {
  originalCourseId: string;
  substituteCourseId: string;
  studentIds: string[];
}

export interface SubstitutionApproval {
  originalCourseId: string;
  substituteCourseId: string;
  studentIds: string[];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : parse.invalid();
}

function nullableText(value: unknown): string | null {
  return value === undefined || value === null ? null : text(value);
}

function strings(value: unknown): string[] {
  return value === undefined ? [] : parse.array(value).map(text);
}

function units(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return parse.string(value);
}

function integer(value: unknown, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  return typeof value === "number" && Number.isInteger(value) ? value : parse.invalid();
}

export function parseCatalogCourse(value: unknown): CatalogCourse {
  const raw = parse.record(value);
  return {
    id: parse.string(raw.id),
    courseCode: parse.string(raw.courseCode),
    title: text(raw.title),
    description: nullableText(raw.description),
    department: nullableText(raw.department),
    college: nullableText(raw.college),
    lectureUnits: units(raw.lectureUnits),
    labUnits: units(raw.labUnits),
    totalUnits: units(raw.totalUnits),
    termOffered: nullableText(raw.termOffered),
    isActive: raw.isActive === undefined ? true : parse.boolean(raw.isActive),
    prerequisiteIds: strings(raw.prerequisiteIds),
    corequisiteIds: strings(raw.corequisiteIds),
    prerequisites: strings(raw.prerequisites),
    corequisites: strings(raw.corequisites),
  };
}

function parseCoursePage(value: unknown): CatalogCoursePage {
  const raw = parse.record(value);
  return {
    items: parse.array(raw.items).map(parseCatalogCourse),
    total: parse.nonNegativeInteger(raw.total),
    limit: parse.nonNegativeInteger(raw.limit),
    offset: parse.nonNegativeInteger(raw.offset),
  };
}

function parseVersion(value: unknown): CurriculumVersion {
  const raw = parse.record(value);
  const year = raw.effectiveAdmissionYear;
  return {
    id: parse.string(raw.id),
    programCode: parse.string(raw.programCode),
    curriculumYear: text(raw.curriculumYear),
    effectiveAdmissionYear: year === undefined || year === null ? null : integer(year),
    courseCount: raw.courses === undefined ? 0 : parse.array(raw.courses).length,
  };
}

function parseSection(value: unknown): CatalogSection {
  const raw = parse.record(value);
  const capacity = parse.nonNegativeInteger(raw.capacity);
  const enrolled = integer(raw.enrolled, 0);
  return {
    id: parse.string(raw.id),
    courseId: parse.string(raw.courseId),
    academicTermId: parse.string(raw.academicTermId),
    facultyId: nullableText(raw.facultyId),
    sectionName: parse.string(raw.sectionName),
    capacity,
    enrolled,
    seatsLeft: integer(raw.seatsLeft, capacity - enrolled),
    room: nullableText(raw.room),
    status: parse.string(raw.status),
  };
}

function parseSubstitution(value: unknown): SubstitutionApproval {
  const raw = parse.record(value);
  return {
    originalCourseId: parse.string(raw.originalCourseId),
    substituteCourseId: parse.string(raw.substituteCourseId),
    studentIds: parse.array(raw.studentIds).map(parse.string),
  };
}

const BASE = "/admin/catalog";

/** The endpoints behind the shared admin catalog page. The API scopes every call by position. */
export function createAdminCatalogApi(client: ApiClient) {
  return {
    async listCourses(
      accessToken: string,
      query: { search: string; limit: number; offset: number },
      signal?: AbortSignal,
    ): Promise<CatalogCoursePage> {
      const params = new URLSearchParams({
        limit: String(query.limit),
        offset: String(query.offset),
      });
      if (query.search.trim()) params.set("search", query.search.trim());
      const data = await client.request(`${BASE}/courses?${params.toString()}`, {
        method: "GET",
        accessToken,
        signal,
      });
      return parseCoursePage(data);
    },

    async createCourse(accessToken: string, body: CatalogCourseInput): Promise<CatalogCourse> {
      return parseCatalogCourse(
        await client.request(`${BASE}/courses`, { method: "POST", accessToken, body }),
      );
    },

    async updateCourse(
      accessToken: string,
      courseId: string,
      body: Partial<CatalogCourseInput>,
    ): Promise<CatalogCourse> {
      const path = `${BASE}/courses/${encodeURIComponent(courseId)}`;
      return parseCatalogCourse(await client.request(path, { method: "PATCH", accessToken, body }));
    },

    async publishCurriculumVersion(
      accessToken: string,
      programCode: string,
      body: CurriculumVersionInput,
    ): Promise<CurriculumVersion> {
      const path = `${BASE}/curricula/${encodeURIComponent(programCode)}/versions`;
      return parseVersion(await client.request(path, { method: "POST", accessToken, body }));
    },

    async deleteCurriculumVersion(accessToken: string, versionId: string): Promise<void> {
      const path = `${BASE}/curricula/versions/${encodeURIComponent(versionId)}`;
      await client.request(path, { method: "DELETE", accessToken });
    },

    async createSection(accessToken: string, body: SectionInput): Promise<CatalogSection> {
      return parseSection(
        await client.request(`${BASE}/sections`, { method: "POST", accessToken, body }),
      );
    },

    async updateSection(
      accessToken: string,
      sectionId: string,
      body: SectionUpdate,
    ): Promise<CatalogSection> {
      const path = `${BASE}/sections/${encodeURIComponent(sectionId)}`;
      return parseSection(await client.request(path, { method: "PATCH", accessToken, body }));
    },

    async approveSubstitution(
      accessToken: string,
      body: SubstitutionInput,
    ): Promise<SubstitutionApproval> {
      return parseSubstitution(
        await client.request(`${BASE}/substitutions`, { method: "POST", accessToken, body }),
      );
    },
  };
}

export type AdminCatalogApi = ReturnType<typeof createAdminCatalogApi>;
