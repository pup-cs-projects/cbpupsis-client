import type { StudentSchedulePath } from "@cbpupsis/shared/schedule";

interface StudentApiEnvironment {
  VITE_API_BASE_URL?: string;
  VITE_STUDENT_SCHEDULE_API_PATH?: string;
}

/** Public build settings; OAuth credentials remain on the backend. */
export function readStudentApiConfig(environment: StudentApiEnvironment): {
  baseUrl: string;
  schedulePath: StudentSchedulePath;
} {
  const schedulePath = environment.VITE_STUDENT_SCHEDULE_API_PATH?.trim() || "/student/schedule";
  if (schedulePath !== "/student/schedule" && schedulePath !== "/students/me/schedule") {
    throw new Error(
      "VITE_STUDENT_SCHEDULE_API_PATH must be /student/schedule or /students/me/schedule.",
    );
  }
  return {
    baseUrl: environment.VITE_API_BASE_URL?.trim() || "http://localhost:8001/api/v1",
    schedulePath,
  };
}
