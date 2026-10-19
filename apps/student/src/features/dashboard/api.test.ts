import { afterEach, describe, expect, it, vi } from "vitest";

import { dashboardApi } from "./api";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("dashboard data before the API has endpoints", () => {
  it("serves nothing in production, so real students never see fictional records", async () => {
    vi.stubEnv("DEV", false);

    await expect(dashboardApi.studentName()).resolves.toBeNull();
    await expect(dashboardApi.currentTerm()).resolves.toBeNull();
    await expect(dashboardApi.announcements()).resolves.toEqual([]);
    await expect(dashboardApi.events()).resolves.toEqual([]);
    await expect(dashboardApi.recentActivity()).resolves.toEqual([]);
  });

  it("serves the mockup's fictional data in development", async () => {
    vi.stubEnv("DEV", true);

    await expect(dashboardApi.studentName()).resolves.toEqual({ fullName: "Juan A. Dela Cruz" });
    await expect(dashboardApi.currentTerm()).resolves.toEqual({
      academicYear: "2026–2027",
      termName: "Second Semester",
    });
    const titles = (await dashboardApi.announcements()).map((item) => item.title);
    expect(titles).toEqual([
      "Summer Term Classes Begin on June 29",
      "Scholarship Renewal Application Deadline Extended",
      "Student Satisfaction Survey Now Available",
      "Updated Academic Calendar Released",
    ]);
    expect((await dashboardApi.events()).map((event) => event.title)).toEqual([
      "Start of Summer Term Classes",
      "Adjustment Period",
      "Deadline for Tuition and Fee Payments",
    ]);
    expect((await dashboardApi.recentActivity()).map((item) => item.status)).toEqual([
      "completed",
      "completed",
      "pending",
    ]);
  });
});
