import type { FacultyDashboardData } from "./types";

/** Fictional development-only data, following the student dashboard's mock convention. */
export const MOCK_DASHBOARD: FacultyDashboardData = {
  fullName: "Juan A. Dela Cruz",
  term: "First Semester 2025-2026",
  studentsTaught: 120,
  courses: [
    {
      code: "CS101",
      title: "Intro to Computing",
      section: "BSCS 1-1",
      schedule: "M/W 09:00 - 10:30",
      status: "ongoing",
    },
    {
      code: "CS102",
      title: "Computer Programming 1",
      section: "BSCS 1-2",
      schedule: "M/W 13:00 - 14:30",
      status: "ongoing",
    },
    {
      code: "GE105",
      title: "Ethics and Values",
      section: "BSEE 2-1",
      schedule: "T/TH 07:30 - 09:00",
      status: "grade-submission",
    },
    {
      code: "CS201",
      title: "Data Structures",
      section: "BSCS 2-1",
      schedule: "T/TH 10:30 - 12:00",
      status: "grade-submission",
    },
  ],
  events: [
    {
      id: "midterm",
      date: "2025-10-15",
      title: "Midterm Grade Submission",
      details: "Final day for encoding grades for 1st Year courses.",
    },
    {
      id: "adjustments",
      date: "2025-10-20",
      title: "Add/Drop Deadline",
      details: "Last day for student academic adjustments.",
    },
    {
      id: "convocation",
      date: "2025-11-05",
      title: "Faculty Convocation",
      details: "PUP Main Theater at 1:00 PM.",
    },
  ],
  announcements: [
    {
      id: "appraisal",
      source: "Administration",
      title: "New Performance Appraisal Form",
      body: "Please submit your self-assessment through the portal by the end of the month.",
    },
    {
      id: "grading",
      source: "Registrar",
      title: "Grade Submission Guidelines",
      body: "Review the updated grading guidelines before submitting your class records.",
    },
  ],
};
