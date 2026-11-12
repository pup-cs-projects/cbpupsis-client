import type { AccountConfig } from "@cbpupsis/account";
import { createApiClient } from "@cbpupsis/shared/api";
import { createPasswordApi, createSession, createStudentAuthApi } from "@cbpupsis/shared/auth";
import { createStudentDashboardApi } from "@cbpupsis/shared/dashboard";
import {
  createStudentAddDropApi,
  createStudentCertificateApi,
  createStudentEnrollmentApi,
  createStudentWaiverApi,
} from "@cbpupsis/shared/enrollment";
import { createStudentGradesApi } from "@cbpupsis/shared/grades";
import { createStudentProfileApi } from "@cbpupsis/shared/profile";
import { createStudentScheduleApi } from "@cbpupsis/shared/schedule";

import { readStudentApiConfig } from "./apiConfig";

const apiConfig = readStudentApiConfig({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_STUDENT_SCHEDULE_API_PATH: import.meta.env.VITE_STUDENT_SCHEDULE_API_PATH,
});
const apiClient = createApiClient(apiConfig.baseUrl);

export const authApi = createStudentAuthApi(apiClient);

/** Password reset and change: the same /auth endpoints for every role. */
export const passwordApi = createPasswordApi(apiClient);

/** The student's landing dashboard in one call (US-101). */
export const studentDashboardApi = createStudentDashboardApi(apiClient);

/** The student's grades and transcript (US-STU-004). */
export const gradesApi = createStudentGradesApi(apiClient);

/** The student's enrollment eligibility, available sections, and submission (US-ENRL-001). */
export const enrollmentApi = createStudentEnrollmentApi(apiClient);

/** The student's prerequisite waiver requests (US-ENRL-002). */
export const studentWaiverApi = createStudentWaiverApi(apiClient);

/** The student's Certificate of Registration: read the issued one, or issue it (issue #43). */
export const certificateApi = createStudentCertificateApi(apiClient);

/** The student's own profile, picture, and emergency contacts (US-STU-002). */
export const profileApi = createStudentProfileApi(apiClient);

/** The student's course schedule and its PDF and .ics exports (US-STU-003). */
export const scheduleApi = createStudentScheduleApi(apiClient, apiConfig.schedulePath);

/** The student's add and drop requests and the sections they may add (US-ENRL-004). */
export const addDropApi = createStudentAddDropApi(apiClient);

/** This app's one session. Tokens stay in memory; a reload restores it from the refresh cookie. */
export const session = createSession(authApi);

/** What the shared account flows need from this portal. */
export const account: AccountConfig = {
  portalName: "Student Portal",
  session,
  passwordApi,
  keepAlive: () => session.authorized(authApi.me),
};
