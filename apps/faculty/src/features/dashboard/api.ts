import { facultyDashboardApi, session } from "../../lib/auth";
import type { FacultyDashboardData } from "./types";

export const dashboardApi = {
  overview: (signal?: AbortSignal): Promise<FacultyDashboardData> =>
    session.authorized((token) => facultyDashboardApi.overview(token, signal)),
};
