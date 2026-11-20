import { mockApi } from "@cbpupsis/account/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { createAppRouter } from "../app/router";
import { me, signInDirectly } from "./fixtures";

export function renderFaculty(path: string, routes: Parameters<typeof mockApi>[0] = {}) {
  signInDirectly();
  const api = mockApi({
    "GET /auth/faculty/me": { status: 200, body: me },
    "GET /users/me": { status: 200, body: { full_name: "Prof. Maria Santos", email: me.email } },
    "POST /auth/faculty/logout": { status: 204 },
    ...routes,
  });
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    ...render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    ...api,
    client,
    router,
  };
}
export const sectionWire = {
  id: "section-1",
  section_name: "BSCS 2-1",
  capacity: 40,
  status: "open",
};
export const studentWire = {
  user_id: "student-1",
  studentNumber: "2026-00001-MN-0",
  name: "Ana Santos",
  email: "ana@example.com",
  enrollmentStatus: "ENROLLED",
  gradeStatus: "PENDING",
  addDropStatus: "PENDING_ADD",
};
export const rosterWire = { ...sectionWire, roster: [studentWire], total: 1, limit: 20, offset: 0 };
