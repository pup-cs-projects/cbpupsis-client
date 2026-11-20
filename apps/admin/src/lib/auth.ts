import type { AccountConfig } from "@cbpupsis/account";
import { createApiClient } from "@cbpupsis/shared/api";
import {
  createAdminAuthApi,
  createPasswordApi,
  createProfileApi,
  createSession,
} from "@cbpupsis/shared/auth";
import { createAdminEnrollmentApi } from "@cbpupsis/shared/enrollment";
import { createIncompleteReviewApi, incompleteReviewContract } from "@cbpupsis/shared/grades";

export const apiClient = createApiClient(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1",
);

export const authApi = createAdminAuthApi(apiClient);

/** Password reset and change: the same /auth endpoints for every role. */
export const passwordApi = createPasswordApi(apiClient);
export const profileApi = createProfileApi(apiClient);
export const enrollmentApi = createAdminEnrollmentApi(apiClient);

export const incompleteReviewApi = createIncompleteReviewApi(apiClient, incompleteReviewContract);

/** This app's one session. Tokens stay in memory; a reload restores it from the refresh cookie. */
export const session = createSession(authApi);

/** What the shared account flows need from this portal. */
export const account: AccountConfig = {
  portalName: "Admin Portal",
  session,
  passwordApi,
  keepAlive: () => session.authorized(authApi.me),
};
