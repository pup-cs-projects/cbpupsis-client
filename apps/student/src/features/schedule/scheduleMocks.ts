/*
 * FICTIONAL, DEVELOPMENT-ONLY DATA. Nothing here is a real student, class, or faculty member.
 *
 * It lets `npm run dev` look like the mockup while the API has no schedule endpoints.
 * useCourseSchedule.ts reads it only when import.meta.env.DEV is true; a production build
 * replaces that flag with false, so this module is dropped from the bundle.
 *
 * Delete each export when its endpoint lands (see the TODO(api) notes in useCourseSchedule.ts),
 * and this file when the last one goes.
 */
import { WEEKDAYS, type CourseItem, type ExportFile, type StudentSchedule } from "./scheduleTypes";

const MOCK_COURSES: CourseItem[] = [
  {
    id: "mock-course-1",
    courseCode: "COMP 016",
    courseTitle: "Web Development",
    units: 3,
    schedule: [{ day: "Mon", timeStart: "07:30", timeEnd: "10:30" }],
    faculty: "Prof. Ricardo M. Santos",
    location: "S508 Main",
  },
  {
    id: "mock-course-2",
    courseCode: "COMP 020",
    courseTitle: "Information Assurance and Security",
    units: 3,
    schedule: [{ day: "Tue", timeStart: "13:00", timeEnd: "16:00" }],
    faculty: "Prof. Angelica R. Villanueva",
    location: "S511 Main",
  },
  {
    id: "mock-course-3",
    courseCode: "COSC 304",
    courseTitle: "Automata Theory and Formal Languages",
    units: 3,
    schedule: [
      { day: "Wed", timeStart: "10:30", timeEnd: "12:00" },
      { day: "Fri", timeStart: "10:30", timeEnd: "12:00" },
    ],
    faculty: "Dr. Leonardo P. Reyes",
    location: "N301 Main",
  },
  {
    id: "mock-course-4",
    courseCode: "COSC 306",
    courseTitle: "Software Engineering 1",
    units: 3,
    schedule: [{ day: "Thu", timeStart: "07:30", timeEnd: "10:30" }],
    faculty: "Prof. Carmela D. Bautista",
    location: "S508 Main",
  },
  {
    id: "mock-course-5",
    courseCode: "COSC 308",
    courseTitle: "Modeling and Simulation",
    units: 3,
    schedule: [{ day: "Fri", timeStart: "13:00", timeEnd: "16:00" }],
    faculty: "Prof. Emmanuel T. Garcia",
    location: "CL2 Main",
  },
  {
    id: "mock-course-6",
    courseCode: "GEED 007",
    courseTitle: "Science, Technology and Society",
    units: 3,
    schedule: [{ day: "Mon", timeStart: "13:00", timeEnd: "16:00" }],
    faculty: "Prof. Josefina L. Cruz",
    location: "W204 Main",
  },
  {
    id: "mock-course-7",
    courseCode: "GEED 032",
    courseTitle: "Filipinolohiya at Pambansang Kaunlaran",
    units: 3,
    schedule: [{ day: "Sat", timeStart: "09:00", timeEnd: "12:00" }],
    faculty: "Prof. Andres B. Mendoza",
    location: "E412 Main",
  },
];

// Literal totals, not a reduce(): a top-level call would keep this module in production bundles.
export const MOCK_SCHEDULE: StudentSchedule = {
  summary: {
    totalUnits: 21,
    totalCourses: 7,
    academicYear: "2025–2026",
    semester: "First Semester",
  },
  courses: MOCK_COURSES,
};

// ---- A local .ics, so Export Calendar works in dev before GET /export/ics exists ----

/** The mock term's first Monday and length, for the weekly repeat. */
const TERM_STARTS_ON = "2025-09-08";
const TERM_WEEKS = 18;

/** Manila is UTC+8 all year (no DST), so a wall-clock time converts by a fixed offset. */
function manilaToUtcStamp(date: Date, hhmm: string) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const utc = new Date(date);
  utc.setUTCHours(hours - 8, minutes, 0, 0);
  return utc
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

const escapeText = (text: string) => text.replace(/[\\;,]/g, (c) => `\\${c}`);

export function mockIcsExport(schedule: StudentSchedule): ExportFile {
  const termStart = new Date(`${TERM_STARTS_ON}T00:00:00Z`);
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CBPUPSIS//Student Portal//EN"];

  for (const course of schedule.courses) {
    course.schedule.forEach((meeting, index) => {
      // WEEKDAYS starts on Monday; getUTCDay() starts on Sunday.
      const offset = (WEEKDAYS.indexOf(meeting.day) + 1 - termStart.getUTCDay() + 7) % 7;
      const first = new Date(termStart);
      first.setUTCDate(first.getUTCDate() + offset);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${course.id}-${index}@cbpupsis.local`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${manilaToUtcStamp(first, meeting.timeStart)}`,
        `DTEND:${manilaToUtcStamp(first, meeting.timeEnd)}`,
        `RRULE:FREQ=WEEKLY;COUNT=${TERM_WEEKS}`,
        `SUMMARY:${escapeText(`${course.courseCode} – ${course.courseTitle}`)}`,
        `LOCATION:${escapeText(course.location)}`,
        `DESCRIPTION:${escapeText(course.faculty)}`,
        "END:VEVENT",
      );
    });
  }
  lines.push("END:VCALENDAR");

  return {
    blob: new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }),
    filename: "course-schedule.ics",
  };
}
