export function readAdminApiConfig(environment: {
  VITE_API_BASE_URL?: string;
  VITE_ADMIN_USERS_API_PATH?: string;
}): { baseUrl: string; usersPath: "/admin/users" } {
  const usersPath = environment.VITE_ADMIN_USERS_API_PATH?.trim() || "/admin/users";
  if (usersPath !== "/admin/users")
    throw new Error("VITE_ADMIN_USERS_API_PATH must be /admin/users.");
  return {
    baseUrl: environment.VITE_API_BASE_URL?.trim() || "http://localhost:8003/api/v1",
    usersPath,
  };
}
