import type { AccountConfig } from "@cbpupsis/account";
import { createApiClient } from "@cbpupsis/shared/api";
import { createPasswordApi, createSession, createStudentAuthApi } from "@cbpupsis/shared/auth";
import { createStudentProfileApi } from "@cbpupsis/shared/profile";
import { createStudentScheduleApi } from "@cbpupsis/shared/schedule";

const apiClient = createApiClient(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1",
);

export const authApi = createStudentAuthApi(apiClient);

/** Password reset and change: the same /auth endpoints for every role. */
export const passwordApi = createPasswordApi(apiClient);

/** The student's own profile, picture, and emergency contacts (US-STU-002). */
export const profileApi = createStudentProfileApi(apiClient);

/** The student's course schedule and its PDF and .ics exports (US-STU-003). */
export const scheduleApi = createStudentScheduleApi(apiClient);

/** This app's one session. Tokens stay in memory; a reload restores it from the refresh cookie. */
export const session = createSession(authApi);

/** What the shared account flows need from this portal. */
export const account: AccountConfig = {
  portalName: "Student Portal",
  session,
  passwordApi,
  keepAlive: () => session.authorized(authApi.me),
};
