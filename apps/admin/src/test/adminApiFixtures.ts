export const courseWire = {
  id: "10000000-0000-4000-8000-000000000001",
  courseCode: "COMP 001",
  title: "Introduction to Computing",
  description: null,
  lectureUnits: "3.0",
  labUnits: "0.0",
  totalUnits: "3.0",
  gradingMode: "NUMERIC",
  isActive: true,
  prerequisites: [],
  corequisites: [],
};
export const userWire = {
  id: "10000000-0000-4000-8000-000000000002",
  email: "synthetic@example.com",
  full_name: "Synthetic User",
  display_name: null,
  is_active: true,
  email_verified_at: "2026-11-17T01:00:00Z",
};
export const notificationWire = {
  id: "10000000-0000-4000-8000-000000000003",
  notification_type: "enrollment.approved",
  title: "Enrollment approved",
  body: "Your synthetic request was approved.",
  read_at: null,
  created_at: "2026-11-17T01:00:00Z",
  payload: { private: "not-for-cache" },
};
export const auditWire = {
  id: "10000000-0000-4000-8000-000000000004",
  action: "catalog.course_updated",
  actor_id: null,
  target_type: "course",
  target_id: courseWire.id,
  occurred_at: "2026-11-17T09:00:00+08:00",
  payload: { secret: "not-for-cache" },
  prior_state: { password: "not-for-cache" },
  new_state: null,
};
export const termId = "10000000-0000-4000-8000-000000000005";
export function pageWire<T>(items: T[], total = items.length, limit = 20, offset = 0) {
  return { items, total, limit, offset };
}
