export interface FacultyDashboardData {
  fullName: string | null;
  term: string | null;
  studentsTaught: number | null;
  courses: {
    code: string;
    title: string;
    section: string;
    schedule: string;
    status: "ongoing" | "grade-submission";
  }[];
  events: { id: string; date: string; title: string; details: string }[];
  announcements: { id: string; source: string; title: string; body: string }[];
}
