import { describe, expect, it } from "vitest";
import { readAdminApiConfig } from "./apiConfig";
describe("admin deployment configuration", () => {
  it("defaults to the Compose admin API and role-prefixed user routes", () => {
    expect(readAdminApiConfig({})).toEqual({
      baseUrl: "http://localhost:8003/api/v1",
      usersPath: "/admin/users",
    });
  });
  it("accepts an explicit deployed API and migrated user namespace", () => {
    expect(
      readAdminApiConfig({
        VITE_API_BASE_URL: " https://api.example.com/api/v1 ",
        VITE_ADMIN_USERS_API_PATH: " /admin/users ",
      }),
    ).toEqual({ baseUrl: "https://api.example.com/api/v1", usersPath: "/admin/users" });
  });
  it("uses defaults for blanks and rejects unsupported namespaces", () => {
    expect(readAdminApiConfig({ VITE_API_BASE_URL: " ", VITE_ADMIN_USERS_API_PATH: " " })).toEqual(
      readAdminApiConfig({}),
    );
    expect(() => readAdminApiConfig({ VITE_ADMIN_USERS_API_PATH: "/users" })).toThrow(
      "VITE_ADMIN_USERS_API_PATH",
    );
    expect(() => readAdminApiConfig({ VITE_ADMIN_USERS_API_PATH: "/users/me" })).toThrow(
      "VITE_ADMIN_USERS_API_PATH",
    );
  });
});
