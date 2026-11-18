import { describe, expect, it } from "vitest";

import { readStudentApiConfig } from "./apiConfig";

describe("student API configuration", () => {
  it("defaults to the Docker student API and migrated schedule routes", () => {
    expect(readStudentApiConfig({})).toEqual({
      baseUrl: "http://localhost:8001/api/v1",
      schedulePath: "/student/schedule",
    });
  });

  it("allows the existing backend schedule namespace without changing the API origin", () => {
    expect(
      readStudentApiConfig({
        VITE_API_BASE_URL: " http://localhost:8001/api/v1 ",
        VITE_STUDENT_SCHEDULE_API_PATH: " /students/me/schedule ",
      }),
    ).toEqual({
      baseUrl: "http://localhost:8001/api/v1",
      schedulePath: "/students/me/schedule",
    });
  });

  it("keeps standalone API deployments configurable", () => {
    expect(
      readStudentApiConfig({ VITE_API_BASE_URL: "http://localhost:8000/api/v1" }).baseUrl,
    ).toBe("http://localhost:8000/api/v1");
  });

  it("uses defaults for blank optional settings", () => {
    expect(
      readStudentApiConfig({ VITE_API_BASE_URL: " ", VITE_STUDENT_SCHEDULE_API_PATH: " " }),
    ).toEqual(readStudentApiConfig({}));
  });

  it.each(["/student/schedule/google-calendar", "https://other.example/schedule"])(
    "rejects an invalid schedule namespace: %s",
    (schedulePath) => {
      expect(() => readStudentApiConfig({ VITE_STUDENT_SCHEDULE_API_PATH: schedulePath })).toThrow(
        "VITE_STUDENT_SCHEDULE_API_PATH",
      );
    },
  );
});
