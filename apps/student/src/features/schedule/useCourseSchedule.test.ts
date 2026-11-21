import type { StudentSchedule } from "@cbpupsis/shared/schedule";
import { describe, expect, it } from "vitest";

import { toPageSchedule } from "./useCourseSchedule";

const api: StudentSchedule = {
  term: { year: "2026-2027", semester: "first" },
  totalCredits: 3,
  state: "ready",
  message: null,
  courses: [
    {
      sectionId: "s1",
      code: "COMP 016",
      title: "Web Development",
      room: null,
      facultyName: null,
      units: 3,
      meetings: [
        { dayOfWeek: 0, startTime: "07:30", endTime: "10:30", room: "S508", type: "lecture" },
        { dayOfWeek: 3, startTime: "13:00", endTime: "16:00", room: null, type: "laboratory" },
      ],
    },
  ],
};

describe("toPageSchedule", () => {
  it("maps the API's term, courses, and meetings into the page's shape", () => {
    expect(toPageSchedule(api)).toEqual({
      term: { year: "2026-2027", semester: "first" },
      summary: {
        totalUnits: 3,
        totalCourses: 1,
        academicYear: "2026–2027",
        semester: "First Semester",
      },
      courses: [
        {
          id: "s1",
          courseCode: "COMP 016",
          courseTitle: "Web Development",
          units: 3,
          schedule: [
            { day: "Mon", timeStart: "07:30", timeEnd: "10:30" },
            { day: "Thu", timeStart: "13:00", timeEnd: "16:00" },
          ],
          faculty: "To be announced",
          location: "S508",
        },
      ],
    });
  });

  it("shows the empty state when the student has no enrollment or no term", () => {
    expect(toPageSchedule({ ...api, courses: [], state: "notEnrolled" })).toBeNull();
    expect(toPageSchedule({ ...api, term: null, state: "termUnavailable" })).toBeNull();
  });
});
