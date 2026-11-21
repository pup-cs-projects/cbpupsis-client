import type { ScheduleTerm } from "@cbpupsis/shared/schedule";

// What the Course Schedule page (US-STU-003) shows. useCourseSchedule.ts maps the API's
// schedule (packages/shared/schedule) into these shapes.

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** One weekly meeting of a class. Times are Manila wall-clock, 24-hour "HH:mm". */
export interface CourseMeeting {
  day: Weekday;
  /** "07:30" */
  timeStart: string;
  /** "10:30" */
  timeEnd: string;
}

/** A course on the schedule. Only enrolled courses are listed, so there is no status. */
export interface CourseItem {
  id: string;
  /** "COMP 016" */
  courseCode: string;
  /** "Web Development" */
  courseTitle: string;
  units: number;
  /** A class may meet more than once a week (a lecture and a lab, say). */
  schedule: CourseMeeting[];
  faculty: string;
  /** "S508 Main" */
  location: string;
}

export interface ScheduleSummary {
  totalUnits: number;
  totalCourses: number;
  /** "2025–2026" */
  academicYear: string;
  /** "First Semester" */
  semester: string;
}

/** The signed-in student's current term. */
export interface StudentSchedule {
  term: ScheduleTerm;
  summary: ScheduleSummary;
  courses: CourseItem[];
}

/** A file the API hands back for download (the COR, the .ics). */
export interface ExportFile {
  blob: Blob;
  filename: string;
}
