import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";

export interface CatalogPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
export interface Course {
  id: string;
  code: string;
  title: string;
  description: string | null;
  lectureUnits: string;
  labUnits: string;
  totalUnits: string;
  gradingMode: string;
  active: boolean;
  prerequisites: string[];
  corequisites: string[];
}
export interface CourseInput {
  courseCode: string;
  title: string;
  description: string | null;
  lectureUnits: string;
  labUnits: string;
  gradingMode: string;
  isActive: boolean;
  prerequisiteIds: string[];
  corequisiteIds: string[];
}
export interface SectionInput {
  courseId: string;
  sectionName: string;
  capacity: number;
  academicTermId?: string;
  facultyId?: string;
  room: string | null;
  meetings: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string | null;
    scheduleType: string;
  }[];
  replaceMeetings?: boolean;
}
export interface SectionRecord {
  id: string;
  sectionName: string;
  capacity: number;
}
export interface CurriculumInput {
  effectiveAdmissionYear: number;
  curriculumYear: string;
  courses: { courseCode: string; yearLevel: number; semester: string; courseType: string }[];
}
export interface CurriculumRecord {
  id: string;
  programCode: string;
  curriculumYear: string;
}
export interface SubstitutionInput {
  originalCourseId: string;
  substituteCourseId: string;
  studentIds: string[];
}
export interface DegreeCourse {
  courseId: string;
  courseCode: string;
  title: string;
  units: string;
  completed: boolean;
  substitutedByCourseCode: string | null;
}
export interface DegreeProgress {
  studentId: string;
  curriculumId: string | null;
  completedUnits: string;
  totalUnitsRequired: string;
  courses: DegreeCourse[];
}

function units(value: unknown): string {
  const result = typeof value === "number" ? String(value) : parse.string(value);
  return /^\d+(?:\.\d+)?$/.test(result) && Number.isFinite(Number(result))
    ? result
    : parse.invalid();
}
function course(value: unknown): Course {
  const raw = parse.record(value);
  return {
    id: parse.string(raw.id),
    code: parse.string(raw.courseCode),
    title: parse.string(raw.title),
    description:
      raw.description == null
        ? null
        : typeof raw.description === "string"
          ? raw.description
          : parse.invalid(),
    lectureUnits: units(raw.lectureUnits),
    labUnits: units(raw.labUnits),
    totalUnits: units(raw.totalUnits),
    gradingMode: parse.string(raw.gradingMode),
    active: parse.boolean(raw.isActive),
    prerequisites: parse.array(raw.prerequisites ?? []).map(parse.string),
    corequisites: parse.array(raw.corequisites ?? []).map(parse.string),
  };
}
function progress(value: unknown): DegreeProgress {
  const raw = parse.record(value);
  return {
    studentId: parse.string(raw.studentId),
    curriculumId: parse.optionalString(raw.curriculumId),
    completedUnits: units(raw.completedUnits),
    totalUnitsRequired: units(raw.totalUnitsRequired),
    courses: parse.array(raw.courses ?? []).map((value) => {
      const row = parse.record(value);
      return {
        courseId: parse.string(row.courseId),
        courseCode: parse.string(row.courseCode),
        title: parse.string(row.title),
        units: units(row.units),
        completed: parse.boolean(row.completed),
        substitutedByCourseCode: parse.optionalString(row.substitutedByCourseCode),
      };
    }),
  };
}

/** Published fr003/fr004 contracts. There are no list APIs for versions, sections or substitutions. */
export function createAdminCatalogApi(client: ApiClient) {
  const base = "/admin/catalog";
  const segment = encodeURIComponent;
  return {
    async courses(
      token: string,
      search = "",
      offset = 0,
      signal?: AbortSignal,
      limit = 20,
    ): Promise<CatalogPage<Course>> {
      const query = new URLSearchParams({
        ...(search ? { search } : {}),
        limit: String(limit),
        offset: String(offset),
      });
      const raw = parse.record(
        await client.request(`${base}/courses?${query}`, {
          method: "GET",
          accessToken: token,
          signal,
        }),
      );
      const result = {
        items: parse.array(raw.items).map(course),
        total: parse.nonNegativeInteger(raw.total),
        limit: parse.nonNegativeInteger(raw.limit),
        offset: parse.nonNegativeInteger(raw.offset),
      };
      if (
        !result.limit ||
        result.items.length > result.limit ||
        (result.items.length && result.total < result.offset + result.items.length)
      )
        parse.invalid();
      return result;
    },
    async saveCourse(token: string, input: CourseInput, id?: string): Promise<Course> {
      return course(
        await client.request(`${base}/courses${id ? `/${segment(id)}` : ""}`, {
          method: id ? "PATCH" : "POST",
          body: input,
          accessToken: token,
        }),
      );
    },
    async saveSection(token: string, input: SectionInput, id?: string): Promise<SectionRecord> {
      const { courseId, academicTermId, meetings, replaceMeetings, room, ...update } = input;
      const body = id
        ? {
            ...update,
            ...(room !== null ? { room } : {}),
            ...(replaceMeetings ? { meetings } : {}),
          }
        : { ...update, room, meetings, courseId, ...(academicTermId ? { academicTermId } : {}) };
      const raw = parse.record(
        await client.request(`${base}/sections${id ? `/${segment(id)}` : ""}`, {
          method: id ? "PATCH" : "POST",
          body,
          accessToken: token,
        }),
      );
      return {
        id: parse.string(raw.id),
        sectionName: parse.string(raw.sectionName),
        capacity: parse.nonNegativeInteger(raw.capacity),
      };
    },
    async publishCurriculum(
      token: string,
      program: string,
      input: CurriculumInput,
    ): Promise<CurriculumRecord> {
      const raw = parse.record(
        await client.request(`${base}/curricula/${segment(program)}/versions`, {
          method: "POST",
          body: input,
          accessToken: token,
        }),
      );
      return {
        id: parse.string(raw.id),
        programCode: parse.string(raw.programCode),
        curriculumYear: parse.string(raw.curriculumYear),
      };
    },
    async deleteCurriculum(token: string, program: string, id: string): Promise<void> {
      await client.request(`${base}/curricula/${segment(program)}/versions/${segment(id)}`, {
        method: "DELETE",
        accessToken: token,
      });
    },
    async approveSubstitution(token: string, input: SubstitutionInput) {
      const raw = parse.record(
        await client.request(`${base}/substitutions`, {
          method: "POST",
          body: input,
          accessToken: token,
        }),
      );
      return {
        originalCourseId: parse.string(raw.originalCourseId),
        substituteCourseId: parse.string(raw.substituteCourseId),
        studentIds: parse.array(raw.studentIds).map(parse.string),
        degreeProgress: parse.array(raw.degreeProgress ?? []).map(progress),
      };
    },
    async degreeProgress(
      token: string,
      studentId: string,
      signal?: AbortSignal,
    ): Promise<DegreeProgress> {
      return progress(
        await client.request(`${base}/students/${segment(studentId)}/degree-progress`, {
          method: "GET",
          accessToken: token,
          signal,
        }),
      );
    },
  };
}
