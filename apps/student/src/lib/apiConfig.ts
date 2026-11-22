interface StudentApiEnvironment {
  VITE_API_BASE_URL?: string;
}

/** Public build settings; OAuth credentials remain on the backend. */
export function readStudentApiConfig(environment: StudentApiEnvironment): { baseUrl: string } {
  return {
    baseUrl: environment.VITE_API_BASE_URL?.trim() || "http://localhost:8001/api/v1",
  };
}
