import { createApiClient } from "@cbpupsis/shared/api";
import { createFacultyAuthApi, createPasswordApi, createSession } from "@cbpupsis/shared/auth";

const apiClient = createApiClient(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1",
);

export const authApi = createFacultyAuthApi(apiClient);

/** Password reset and change: the same /auth endpoints for every role. */
export const passwordApi = createPasswordApi(apiClient);

/** This app's one session. Tokens stay in memory: a reload signs the faculty member out. */
export const session = createSession(authApi);
