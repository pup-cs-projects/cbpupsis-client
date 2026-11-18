import axe from "axe-core";
import { mockApi } from "@cbpupsis/account/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppRouter } from "../../app/router";
import { session } from "../../lib/auth";
import { pageWire, courseWire } from "../../test/adminApiFixtures";
import { me, signInDirectly } from "../../test/fixtures";
import { createMockRequests } from "../enrollment-requests/mockData";

const request = createMockRequests().addDrop[0]!;
const ADD = "GET /admin/add-drop",
  OVERLOAD = "GET /admin/overload-requests",
  WAIVERS = "GET /admin/waiver-requests";
beforeEach(() => vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null));
afterEach(async () => {
  cleanup();
  mockApi({ "POST /auth/admin/logout": { status: 204 } });
  await session.signOut();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function open(position = "registrar", routes: Parameters<typeof mockApi>[0] = {}) {
  signInDirectly();
  const api = mockApi({
    "GET /admin/me": {
      status: 200,
      body: { ...me, position, department_id: "CS", college_id: "CCIS" },
    },
    "GET /users/me": { status: 200, body: { full_name: "Test Admin", display_name: "Test Admin" } },
    "GET /admin/catalog/courses": { status: 200, body: pageWire([courseWire]) },
    "GET /notifications/unread-count": { status: 200, body: { unread: 0 } },
    [ADD]: { status: 200, body: [] },
    [OVERLOAD]: { status: 200, body: [] },
    [WAIVERS]: { status: 200, body: pageWire([]) },
    ...routes,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createAppRouter(createMemoryHistory({ initialEntries: ["/dashboard"] }));
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return api;
}
describe("Enrollment request activity from live scoped endpoints", () => {
  it("shows a newly filed student request after refresh without fabricating an audit log", async () => {
    const api = open("chairperson", {
      [ADD]: [
        { status: 200, body: [] },
        { status: 200, body: [request] },
      ],
    });
    await screen.findByText("No enrollment-request activity is available yet.");
    await userEvent.setup().click(screen.getByRole("button", { name: "Refresh overview" }));
    await screen.findByText("Andrea Reyes filed an add/drop request.");
    expect(
      (await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } }))
        .violations,
    ).toEqual([]);
    expect(api.called(ADD)).toHaveLength(2);
    expect(api.called("GET /audit")).toHaveLength(0);
    expect(api.calls.filter((call) => call.route.startsWith("POST "))).toHaveLength(0);
    expect(
      screen.getByText(/Activity includes add\/drop, overload, and waiver requests in your scope/),
    ).toBeInTheDocument();
  });
  it.each(["chairperson", "dean", "registrar"])(
    "%s displays only records returned by its scoped request APIs",
    async (position) => {
      const api = open(position, { [ADD]: { status: 200, body: [request] } });
      await screen.findByText("Andrea Reyes filed an add/drop request.");
      expect(api.called(ADD)[0]!.authorization).toBe("Bearer access-1");
      expect(api.called(OVERLOAD)).toHaveLength(1);
      expect(api.called(WAIVERS)).toHaveLength(1);
      expect(api.called("GET /audit")).toHaveLength(0);
    },
  );
  it("updates the current request status on refresh without duplicating the filing", async () => {
    open("registrar", {
      [ADD]: [
        { status: 200, body: [request] },
        { status: 200, body: [{ ...request, state: "APPROVED", version: 2 }] },
      ],
    });
    await screen.findByText("Andrea Reyes filed an add/drop request.");
    await userEvent.setup().click(screen.getByRole("button", { name: "Refresh overview" }));
    await screen.findByText("Approved");
    expect(screen.getAllByText("Andrea Reyes filed an add/drop request.")).toHaveLength(1);
  });
  it("a failed stream is disclosed without hiding other available activity", async () => {
    open("registrar", {
      [ADD]: { status: 200, body: [request] },
      [OVERLOAD]: { status: 503, body: {} },
    });
    await screen.findByText("Andrea Reyes filed an add/drop request.");
    await screen.findByText("Overload activity could not be loaded. Refresh to retry.");
  });
  it("Finance does not query enrollment activity or global audit", async () => {
    const api = open("finance");
    await screen.findByText("Enrollment-request activity is not available to this account.");
    expect(api.called(ADD)).toHaveLength(0);
    expect(api.called(OVERLOAD)).toHaveLength(0);
    expect(api.called(WAIVERS)).toHaveLength(0);
    expect(api.called("GET /audit")).toHaveLength(0);
  });
});
