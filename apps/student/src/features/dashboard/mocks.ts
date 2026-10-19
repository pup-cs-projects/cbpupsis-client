/*
 * FICTIONAL, DEVELOPMENT-ONLY DATA. Nothing here is a real student, announcement, or date.
 *
 * It lets `npm run dev` look like the mockup while the API has no dashboard endpoints.
 * api.ts returns it only when import.meta.env.DEV is true; a production build replaces that
 * flag with false, so this module is dropped from the bundle and real students never see it.
 *
 * Delete each export when its endpoint lands (see the TODO(api) notes in api.ts), and this file
 * when the last one goes. The texts follow the design branch's dashboardMocks.ts, merged here.
 */
import type { AcademicTerm, ActivityItem, Announcement, CalendarEvent, StudentName } from "./types";

export const MOCK_STUDENT_NAME: StudentName = { fullName: "Juan A. Dela Cruz" };

export const MOCK_CURRENT_TERM: AcademicTerm = {
  academicYear: "2026–2027",
  termName: "Second Semester",
};

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "mock-announcement-1",
    title: "Summer Term Classes Begin on June 29",
    body: "Students enrolled for the Summer Term AY 2025–2026 are reminded that classes officially begin on June 29, 2026. Please check your schedules and course assignments.",
  },
  {
    id: "mock-announcement-2",
    title: "Scholarship Renewal Application Deadline Extended",
    body: "The deadline for scholarship renewal submissions has been extended until June 25, 2026. Submit all required documents through the Forms Portal.",
  },
  {
    id: "mock-announcement-3",
    title: "Student Satisfaction Survey Now Available",
    body: "Help improve university services by completing the Student Satisfaction Survey. Responses will be accepted until June 30, 2026.",
  },
  {
    id: "mock-announcement-4",
    title: "Updated Academic Calendar Released",
    body: "The revised Academic Calendar for AY 2025–2026 is now available. Review the updated schedule of academic activities and examination periods.",
  },
];

export const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: "mock-event-1",
    startsOn: "2026-06-29",
    endsOn: null,
    title: "Start of Summer Term Classes",
    details: "Classes for the Summer Term follow the schedule on your Certificate of Registration.",
  },
  {
    id: "mock-event-2",
    startsOn: "2026-06-29",
    endsOn: "2026-07-01",
    title: "Adjustment Period",
    details: "Add, drop, or change subjects during these dates.",
  },
  {
    id: "mock-event-3",
    startsOn: "2026-07-15",
    endsOn: null,
    title: "Deadline for Tuition and Fee Payments",
    details: "Settle your assessment by this date to avoid a late payment penalty.",
  },
];

// Times in UTC, as the API will send them: 02:42Z is 10:42 AM in Manila.
export const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: "mock-activity-1",
    occurredAt: "2026-06-27T02:42:00Z",
    description: "Successfully enrolled for Summer Term AY 2025–2026.",
    status: "completed",
  },
  {
    id: "mock-activity-2",
    occurredAt: "2026-06-27T02:40:00Z",
    description: "Certificate of Registration generated.",
    status: "completed",
  },
  {
    id: "mock-activity-3",
    occurredAt: "2026-06-26T07:15:00Z",
    description: "Tuition payment submitted and awaiting confirmation.",
    status: "pending",
  },
];
