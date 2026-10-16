import { createApiClient } from "@cbpupsis/shared/api";
import { createSession, createSuperadminAuthApi } from "@cbpupsis/shared/auth";

const apiClient = createApiClient(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1",
);

export const authApi = createSuperadminAuthApi(apiClient);

/** This app's one session. Tokens stay in memory: a reload signs the superadmin out. */
export const session = createSession(authApi);
