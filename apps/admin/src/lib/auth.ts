import type { AccountConfig } from "@cbpupsis/account";
import { createApiClient } from "@cbpupsis/shared/api";
import {
  createAdminAuthApi,
  createPasswordApi,
  createProfileApi,
  createSession,
} from "@cbpupsis/shared/auth";
import { createAdminEnrollmentApi } from "@cbpupsis/shared/enrollment";

import { readAdminApiConfig } from "./apiConfig";
export const apiConfig = readAdminApiConfig({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_ADMIN_USERS_API_PATH: import.meta.env.VITE_ADMIN_USERS_API_PATH,
});
export const apiClient = createApiClient(apiConfig.baseUrl);

export const authApi = createAdminAuthApi(apiClient);

/** Password reset and change: the same /auth endpoints for every role. */
export const passwordApi = createPasswordApi(apiClient);
export const profileApi = createProfileApi(apiClient);
export const enrollmentApi = createAdminEnrollmentApi(apiClient);

/** This app's one session. Tokens stay in memory; a reload restores it from the refresh cookie. */
export const session = createSession(authApi);

/** What the shared account flows need from this portal. */
export const account: AccountConfig = {
  portalName: "Admin Portal",
  session,
  passwordApi,
  keepAlive: () => session.authorized(authApi.me),
};
