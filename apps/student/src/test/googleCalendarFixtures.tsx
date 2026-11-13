import { mockApi } from "@cbpupsis/account/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { vi } from "vitest";

import { createAppRouter } from "../app/router";
import { me, ME_ROUTE, signInDirectly } from "./fixtures";

export const CALENDAR_ROUTE = "GET /student/schedule/google-calendar";
export const AUTHORIZE_ROUTE = "POST /student/schedule/google-calendar/authorization";
export const CALLBACK_ROUTE = "POST /student/schedule/google-calendar/callback";
export const SYNC_ROUTE = "POST /student/schedule/google-calendar/sync";
export const DISCONNECT_ROUTE = "DELETE /student/schedule/google-calendar";

export const calendarStatus = {
  enabled: true,
  connected: false,
  disconnecting: false,
  last_sync_at: null,
  next_sync_at: null,
  last_error: null,
  targets: [],
};
export const connectedCalendar = {
  ...calendarStatus,
  connected: true,
  last_sync_at: "2026-11-10T01:30:00Z",
  next_sync_at: "2026-11-11T03:00:00Z",
  targets: [{ year: "2026-2027", semester: "first", provisioned: true }],
};
export const scheduleResponse = {
  term: { year: "2026-2027", semester: "first" },
  total_credits: "3.0",
  state: "ready",
  message: null,
  courses: [
    {
      section_id: "10000000-0000-4000-8000-000000000001",
      code: "COMP 016",
      title: "Web Development",
      room: "S508",
      faculty_name: "Demo Faculty",
      units: "3.0",
      meetings: [
        {
          day_of_week: 0,
          start_time: "07:30:00",
          end_time: "10:30:00",
          room: "S508",
          type: "lecture",
        },
      ],
    },
  ],
};
export const dashboardResponse = {
  student: {
    student_number: "DEMO-2026-0001",
    name: "Demo Student",
    programme: "BSCS",
    year_level: 2,
    enrollment_status: "ENROLLED",
    avatar_url: null,
  },
  current_term: { academic_year: "2026-2027", semester: "first" },
  announcements: [],
  events: [],
  recent_activity: [],
  empty_states: { announcements: null, events: null, recent_activity: null },
};

export function mockCalendarApi(routes: Parameters<typeof mockApi>[0] = {}, signedIn = true) {
  if (signedIn) signInDirectly();
  return mockApi({
    [ME_ROUTE]: { status: 200, body: me },
    "GET /student/me/dashboard": { status: 200, body: dashboardResponse },
    "GET /student/schedule": { status: 200, body: scheduleResponse },
    [CALENDAR_ROUTE]: { status: 200, body: calendarStatus },
    ...routes,
  });
}

export function renderCalendarApp(path = "/schedule", strict = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
  const tree = () => (
    <QueryClientProvider client={client}>
      {strict ? (
        <StrictMode>
          <RouterProvider router={router} />
        </StrictMode>
      ) : (
        <RouterProvider router={router} />
      )}
    </QueryClientProvider>
  );
  const view = render(tree());
  return { ...view, router, client, rerenderPage: () => view.rerender(tree()) };
}

export function calendarTestDom() {
  const methods = {
    showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal"),
    close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close"),
    createObjectURL: Object.getOwnPropertyDescriptor(URL, "createObjectURL"),
    revokeObjectURL: Object.getOwnPropertyDescriptor(URL, "revokeObjectURL"),
  };
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    },
  });
  Object.defineProperties(URL, {
    createObjectURL: { configurable: true, value: vi.fn(() => "blob:test-calendar-file") },
    revokeObjectURL: { configurable: true, value: vi.fn() },
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  return () => {
    for (const method of ["showModal", "close"] as const) {
      const original = methods[method];
      if (original) Object.defineProperty(HTMLDialogElement.prototype, method, original);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, method);
    }
    for (const method of ["createObjectURL", "revokeObjectURL"] as const) {
      const original = methods[method];
      if (original) Object.defineProperty(URL, method, original);
      else Reflect.deleteProperty(URL, method);
    }
  };
}
