import { createPortalRouter } from "@cbpupsis/account";
import { mockApi } from "@cbpupsis/account/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRoute, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { account, session } from "../../lib/auth";
import { me, signInDirectly } from "../../test/fixtures";
import { EnrollmentRequestsPage } from "./EnrollmentRequestsPage";

const empty = { status: 200, body: [] };

/** The page as the router mounts it: no data source passed in. */
function openPage(position: string, addDrop: Parameters<typeof mockApi>[0][string] = empty) {
  signInDirectly();
  const api = mockApi({
    "GET /admin/me": { status: 200, body: { ...me, position } },
    "GET /users/me": { status: 200, body: { full_name: "Reviewer", display_name: "Reviewer" } },
    "GET /admin/add-drop": addDrop,
  });
  const router = createPortalRouter({
    config: account,
    signIn: () => <p>Sign in</p>,
    dashboard: () => <p>Dashboard</p>,
    extraRoutes: (root) => [
      createRoute({
        getParentRoute: () => root,
        path: "/enrollment-requests",
        component: () => <EnrollmentRequestsPage />,
      }),
    ],
    history: createMemoryHistory({ initialEntries: ["/enrollment-requests"] }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return api;
}

/** The link sits inside the Academics section, which starts closed. */
async function openAcademics() {
  await userEvent.setup().click(await screen.findByRole("button", { name: "Academics" }));
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

afterEach(async () => {
  cleanup();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  await session.signOut();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Enrollment requests source", () => {
  it("AC-ENRL-004.1: reads the real API by default, in development too", async () => {
    const api = openPage("chairperson");

    await screen.findByRole("heading", { name: "No requests to review" });

    expect(api.called("GET /admin/add-drop")).toHaveLength(1);
  });

  it("AC-ENRL-004.1: a failing API shows the error state and no sample data", async () => {
    openPage("chairperson", { status: 503, body: { detail: "Service unavailable" } });

    await screen.findByText("Requests could not be loaded");

    expect(screen.getByRole("button", { name: /retry|try again/i })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("AC-ENRL-004.11: a missing permission shows the error state without its internal name", async () => {
    openPage("chairperson", {
      status: 403,
      body: { detail: "Missing required permission(s): ['ReadAddDropRequest']" },
    });

    await screen.findByText("Your account does not have access to these requests.");

    expect(screen.queryByText(/ReadAddDropRequest/)).not.toBeInTheDocument();
  });

  it("AC-ENRL-004.1: the mock flag opts a development build into sample data", async () => {
    vi.stubEnv("VITE_ENROLLMENT_REQUESTS_MOCK", "true");
    const api = openPage("chairperson");

    await screen.findByRole("table");

    expect(api.called("GET /admin/add-drop")).toHaveLength(0);
  });

  it("AC-ENRL-004.1: the mock flag does nothing outside development", async () => {
    vi.stubEnv("VITE_ENROLLMENT_REQUESTS_MOCK", "true");
    vi.stubEnv("DEV", false);
    const api = openPage("chairperson");

    await waitFor(() => expect(api.called("GET /admin/add-drop")).toHaveLength(1));
  });
});

describe("Enrollment requests nav", () => {
  it.each(["chairperson", "dean", "registrar"])(
    "AC-ENRL-004.11: %s sees the nav link",
    async (position) => {
      openPage(position);
      await screen.findByRole("tablist");
      await openAcademics();

      expect(await screen.findByRole("link", { name: "Enrollment requests" })).toHaveAttribute(
        "href",
        "/enrollment-requests",
      );
    },
  );

  it("AC-ENRL-004.11: finance gets neither the nav link nor the page", async () => {
    const api = openPage("finance");

    await screen.findByRole("heading", { name: "Not available to your role" });
    await openAcademics();

    expect(await screen.findByText("Courses")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Enrollment requests" })).not.toBeInTheDocument();
    expect(api.called("GET /admin/add-drop")).toHaveLength(0);
  });
});
