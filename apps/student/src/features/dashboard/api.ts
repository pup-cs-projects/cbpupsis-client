import {
  MOCK_ACTIVITY,
  MOCK_ANNOUNCEMENTS,
  MOCK_CURRENT_TERM,
  MOCK_EVENTS,
  MOCK_STUDENT_NAME,
} from "./mocks";
import type { AcademicTerm, ActivityItem, Announcement, CalendarEvent, StudentName } from "./types";

/*
 * Fictional data in `npm run dev` only, so local development looks like the mockup. Each call
 * reads import.meta.env.DEV inline: a production build replaces it with false, folds each
 * ternary to its empty branch, and drops mocks.ts from the bundle, so real students see each
 * section's empty state until its endpoint exists. (Behind a helper function the minifier would
 * keep the mocks.) Tests can stub the flag, because it is read on each call.
 */

/**
 * The dashboard's data calls. No endpoint exists for any of them yet.
 *
 * When an endpoint lands, its call goes in packages/shared (CONVENTIONS: data flow), parsed at
 * the boundary, and the function here calls it through the portal's session; then delete its
 * mock from mocks.ts.
 */
export const dashboardApi = {
  // TODO(api): GET /students/me/profile (or a name on GET /auth/student/me): full name (FR4).
  // Never derive a name from the email.
  async studentName(): Promise<StudentName | null> {
    return import.meta.env.DEV ? MOCK_STUDENT_NAME : null;
  },

  // TODO(api): GET /academic-calendar/current: academic year and term name (FR11).
  async currentTerm(): Promise<AcademicTerm | null> {
    return import.meta.env.DEV ? MOCK_CURRENT_TERM : null;
  },

  // TODO(api): GET /announcements?audience=student: title and body, newest first.
  async announcements(): Promise<Announcement[]> {
    return import.meta.env.DEV ? MOCK_ANNOUNCEMENTS : [];
  },

  // TODO(api): GET /academic-calendar/events?from=today: upcoming dates for students (FR11).
  async events(): Promise<CalendarEvent[]> {
    return import.meta.env.DEV ? MOCK_EVENTS : [];
  },

  // TODO(api): GET /students/me/activity?limit=5: the student's own recent actions, such as an
  // enrollment or a payment, with a status.
  async recentActivity(): Promise<ActivityItem[]> {
    return import.meta.env.DEV ? MOCK_ACTIVITY : [];
  },
};
