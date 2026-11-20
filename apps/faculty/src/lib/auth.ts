import type { AccountConfig } from "@cbpupsis/account";
import { createApiClient } from "@cbpupsis/shared/api";
import {
  createFacultyAuthApi,
  createPasswordApi,
  createProfileApi,
  createSession,
} from "@cbpupsis/shared/auth";

import { createFacultyGradesApi } from "@cbpupsis/shared/grades";
import { facultyGradesContract } from "@cbpupsis/shared/grades";
import { createFacultyProfileApi } from "@cbpupsis/shared/profile";
import { createFacultySectionsApi } from "@cbpupsis/shared/sections/faculty";
import { createFacultyDashboardApi } from "@cbpupsis/shared/dashboard";

export const apiClient = createApiClient(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8002/api/v1",
);

export const authApi = createFacultyAuthApi(apiClient);

/** Password reset and change: the same /auth endpoints for every role. */
export const passwordApi = createPasswordApi(apiClient);
export const profileApi = createProfileApi(apiClient);

export const facultyGradesApi = createFacultyGradesApi(apiClient, facultyGradesContract);
export const facultySectionsApi = createFacultySectionsApi(apiClient);
export const facultyProfileApi = createFacultyProfileApi(apiClient);
export const facultyDashboardApi = createFacultyDashboardApi(apiClient);

/** This app's one session. Tokens stay in memory; a reload restores it from the refresh cookie. */
export const session = createSession(authApi);

/** What the shared account flows need from this portal. */
export const account: AccountConfig = {
  portalName: "Faculty Portal",
  session,
  passwordApi,
  keepAlive: () => session.authorized(authApi.me),
};
