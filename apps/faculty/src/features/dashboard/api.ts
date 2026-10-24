import { MOCK_DASHBOARD } from "./mocks";
import type { FacultyDashboardData } from "./types";

export const dashboardApi = {
  // TODO(api): Replace with authorized dashboard calls when faculty endpoints are available.
  // Match the student portal: production never presents fictional records as live data.
  async overview(): Promise<FacultyDashboardData> {
    return import.meta.env.DEV
      ? MOCK_DASHBOARD
      : {
          fullName: null,
          term: null,
          studentsTaught: null,
          courses: [],
          events: [],
          announcements: [],
        };
  },
};
