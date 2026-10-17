// UI-development mock data.
// To re-enable in HomePage.tsx, replace the empty arrays with these exports:
//   const announcements = MOCK_ANNOUNCEMENTS;
//   const events = MOCK_EVENTS;
//   const recentActivities = MOCK_RECENT_ACTIVITY;

export interface Announcement {
  id: number;
  title: string;
  body: string;
}

export interface AcademicEvent {
  id: number;
  date: string;
  title: string;
}

export interface ActivityItem {
  id: number;
  timestamp: string;
  description: string;
}

export interface ActiveTerm {
  academicYear: string;
  semester: string;
}

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 1,
    title: "Summer Term Classes Begin on June 29",
    body: "Students enrolled for the Summer Term AY 2025–2026 are reminded that classes officially begin on June 29, 2026. Please check your schedules and course assignments.",
  },
  {
    id: 2,
    title: "Scholarship Renewal Application Deadline Extended",
    body: "The deadline for scholarship renewal submissions has been extended until June 25, 2026. Submit all required documents through the Forms Portal.",
  },
  {
    id: 3,
    title: "Student Satisfaction Survey Now Available",
    body: "Help improve university services by completing the Student Satisfaction Survey. Responses will be accepted until June 30, 2026.",
  },
  {
    id: 4,
    title: "Updated Academic Calendar Released",
    body: "The revised Academic Calendar for AY 2025–2026 is now available. Review the updated schedule of academic activities and examination periods.",
  },
];

export const MOCK_EVENTS: AcademicEvent[] = [
  { id: 1, date: "June 29, 2026", title: "Start of Summer Term Classes" },
  { id: 2, date: "June 29 – July 1, 2026", title: "Adjustment Period" },
  { id: 3, date: "July 15, 2026", title: "Deadline for Tuition and Fee Payments" },
];

export const MOCK_RECENT_ACTIVITY: ActivityItem[] = [
  {
    id: 1,
    timestamp: "June 27, 2026 • 10:42 AM",
    description: "Successfully enrolled for Summer Term AY 2025–2026.",
  },
  {
    id: 2,
    timestamp: "June 27, 2026 • 10:40 AM",
    description: "Certificate of Registration generated.",
  },
];

export const MOCK_ACTIVE_TERM: ActiveTerm = {
  academicYear: "2026–2027",
  semester: "Second Semester",
};
