import type { ApiClient } from "../api/client";
import * as parse from "../api/parse";
import { parseAddDropCourse, type AddDropCourseRead } from "./admin";

/** Wire contracts from backend docs/openapi.json (fr003). Decimal units stay strings. */
export interface AddDropRequestRead {
  requestId: string;
  studentId: string;
  academicTermId: string;
  state: "PENDING" | "APPROVED" | "REJECTED";
  unitsBefore: string;
  unitsAfter: string;
  comments?: string | null;
  remarks?: string | null;
  version?: number;
  courses?: Array<AddDropCourseRead>;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
}

export interface AddDropRequestCreate {
  add?: Array<{ sectionId: string }>;
  /** The API requires a reason for every drop. */
  drop?: Array<{ sectionId: string; reason: string }>;
  comments?: string | null;
}

export interface AddDropCourseMeeting {
  /** Monday = 0 ... Sunday = 6. */
  day: number;
  /** Manila wall-clock "HH:mm:ss". */
  start: string;
  end: string;
  room: string | null;
}

/** The fields of AddDropAvailableCourse the add and drop page reads. */
export interface AddDropAvailableCourse {
  sectionId: string;
  courseCode: string;
  title: string;
  units: string;
  schedule: AddDropCourseMeeting[];
  faculty: string | null;
  capacity: number;
  availableSlots: number;
}

// Free text may legitimately be empty, which parse.string refuses.
function text(value: unknown): string {
  return typeof value === "string" ? value : parse.invalid();
}

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  return value === null ? null : text(value);
}

export function parseAddDropRequest(value: unknown): AddDropRequestRead {
  const raw = parse.record(value);
  return {
    requestId: parse.string(raw.requestId),
    studentId: parse.string(raw.studentId),
    academicTermId: parse.string(raw.academicTermId),
    state: parse.oneOf(raw.state, ["PENDING", "APPROVED", "REJECTED"]),
    unitsBefore: parse.string(raw.unitsBefore),
    unitsAfter: parse.string(raw.unitsAfter),
    comments: optionalText(raw.comments),
    remarks: optionalText(raw.remarks),
    version: raw.version === undefined ? undefined : parse.nonNegativeInteger(raw.version),
    courses:
      raw.courses === undefined
        ? undefined
        : parse.array(raw.courses).map((course) => parseAddDropCourse(course)),
    createdAt: parse.string(raw.createdAt),
    reviewedAt: optionalText(raw.reviewedAt),
    reviewedBy: optionalText(raw.reviewedBy),
  };
}

function parseMeeting(value: unknown): AddDropCourseMeeting {
  const raw = parse.record(value);
  return {
    day: parse.nonNegativeInteger(raw.day),
    start: parse.string(raw.start),
    end: parse.string(raw.end),
    room: parse.optionalString(raw.room),
  };
}

function parseAvailableCourse(value: unknown): AddDropAvailableCourse {
  const raw = parse.record(value);
  return {
    sectionId: parse.string(raw.sectionId),
    courseCode: text(raw.courseCode),
    title: text(raw.title),
    units: parse.string(raw.units),
    schedule:
      raw.schedule === undefined ? [] : parse.array(raw.schedule).map((m) => parseMeeting(m)),
    faculty: parse.optionalString(raw.faculty),
    capacity: parse.nonNegativeInteger(raw.capacity),
    availableSlots: parse.nonNegativeInteger(raw.availableSlots),
  };
}

/** The student's add and drop endpoints (US-ENRL-004) and the sections they may add. */
export function createStudentAddDropApi(client: ApiClient) {
  return {
    async list(accessToken: string): Promise<AddDropRequestRead[]> {
      const data = await client.request("/student/enrollment/add-drop", {
        method: "GET",
        accessToken,
      });
      return parse.array(data).map((item) => parseAddDropRequest(item));
    },

    async get(accessToken: string, requestId: string): Promise<AddDropRequestRead> {
      const path = `/student/enrollment/add-drop/${encodeURIComponent(requestId)}`;
      return parseAddDropRequest(await client.request(path, { method: "GET", accessToken }));
    },

    async create(accessToken: string, body: AddDropRequestCreate): Promise<AddDropRequestRead> {
      const data = await client.request("/student/enrollment/add-drop", {
        method: "POST",
        accessToken,
        body,
      });
      return parseAddDropRequest(data);
    },

    /** `term` is the stored academic year and semester joined by a hyphen. */
    async availableCourses(accessToken: string, term: string): Promise<AddDropAvailableCourse[]> {
      const path = `/student/enrollment/available-courses?term=${encodeURIComponent(term)}`;
      const data = await client.request(path, { method: "GET", accessToken });
      return parse.array(data).map((item) => parseAvailableCourse(item));
    },
  };
}

export type StudentAddDropApi = ReturnType<typeof createStudentAddDropApi>;
