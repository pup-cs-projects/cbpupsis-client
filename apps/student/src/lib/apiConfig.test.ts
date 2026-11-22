import { describe, expect, it } from "vitest";

import { readStudentApiConfig } from "./apiConfig";

describe("student API configuration", () => {
  it("defaults to the Docker student API", () => {
    expect(readStudentApiConfig({})).toEqual({ baseUrl: "http://localhost:8001/api/v1" });
  });

  it("trims a configured API origin", () => {
    expect(readStudentApiConfig({ VITE_API_BASE_URL: " http://localhost:8001/api/v1 " })).toEqual({
      baseUrl: "http://localhost:8001/api/v1",
    });
  });

  it("keeps standalone API deployments configurable", () => {
    expect(
      readStudentApiConfig({ VITE_API_BASE_URL: "http://localhost:8000/api/v1" }).baseUrl,
    ).toBe("http://localhost:8000/api/v1");
  });

  it("uses the default for a blank API origin", () => {
    expect(readStudentApiConfig({ VITE_API_BASE_URL: " " })).toEqual(readStudentApiConfig({}));
  });
});
