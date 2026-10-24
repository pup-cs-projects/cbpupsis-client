import { MOCK_DASHBOARD } from "./mocks";
import type { AdminDashboardData } from "./types";

export const dashboardApi = {
  // TODO(api): Wire authorized overview and audit endpoints when contracts exist.
  async overview(): Promise<AdminDashboardData> {
    return import.meta.env.DEV
      ? MOCK_DASHBOARD
      : {
          academicYear: null,
          metrics: [],
          activity: [],
          events: [],
        };
  },
};
