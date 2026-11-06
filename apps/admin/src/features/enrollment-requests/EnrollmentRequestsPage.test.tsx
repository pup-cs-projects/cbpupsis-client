import { createPortalRouter } from "@cbpupsis/account";
import { mockApi } from "@cbpupsis/account/testing";
import { ApiError } from "@cbpupsis/shared/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRoute, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { account, session } from "../../lib/auth";
import { me, signInDirectly } from "../../test/fixtures";
import { EnrollmentRequestsPage } from "./EnrollmentRequestsPage";
import { createMockReviewDataSource } from "./mockDataSource";
import type { EnrollmentReviewDataSource } from "./types";

const firstAddDrop = "10000000-0000-4000-8000-000000000001";

function openPage(
  position: string,
  dataSource: EnrollmentReviewDataSource = createMockReviewDataSource(me.id, "chairperson"),
) {
  signInDirectly();
  mockApi({
    "GET /admin/me": { status: 200, body: { ...me, position } },
    "GET /users/me": {
      status: 200,
      body: { full_name: "Demo Reviewer", display_name: "Demo Reviewer" },
    },
  });
  const router = createPortalRouter({
    config: account,
    signIn: () => <p>Sign in</p>,
    dashboard: () => <p>Dashboard</p>,
    extraRoutes: (root) => [
      createRoute({
        getParentRoute: () => root,
        path: "/enrollment-requests",
        component: () => <EnrollmentRequestsPage dataSource={dataSource} />,
      }),
    ],
    history: createMemoryHistory({ initialEntries: ["/enrollment-requests"] }),
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return dataSource;
}

const dialogMethods = {
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal"),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close"),
};
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  // jsdom does not implement native modal dialog opening/focus management.
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
});
afterEach(() => {
  cleanup();
  for (const method of ["showModal", "close"] as const) {
    const original = dialogMethods[method];
    if (original) Object.defineProperty(HTMLDialogElement.prototype, method, original);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, method);
  }
  session.signOut();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("EnrollmentRequestsPage (US-ENRL-004 frontend)", () => {
  it.each([
    ["chairperson", 4, 0, 2],
    ["dean", 4, 4, 1],
    ["registrar", 0, 0, 1],
  ] as const)(
    "AC-ENRL-004.11: %s only gets its own review actions, without a role switcher",
    async (role, addDrop, overload, waivers) => {
      openPage(role, createMockReviewDataSource(me.id, role));
      await screen.findByRole("table");
      expect(
        screen
          .getAllByRole("button", { name: /^(Review|View) request/ })
          .filter((button) => button.getAttribute("aria-label")?.startsWith("Review")),
      ).toHaveLength(addDrop);
      expect(screen.queryByLabelText("Review role")).not.toBeInTheDocument();
      const user = userEvent.setup();
      await user.click(screen.getByRole("tab", { name: "Overload" }));
      await screen.findAllByText("27 units requested");
      expect(screen.queryAllByRole("button", { name: /^Review request/ })).toHaveLength(overload);
      await user.click(screen.getByRole("tab", { name: "Waivers" }));
      await screen.findAllByText("Prerequisite exception");
      expect(screen.queryAllByRole("button", { name: /^Review request/ })).toHaveLength(waivers);
      expect(screen.queryByText("Andrea Reyes")).not.toBeInTheDocument();
    },
  );

  it("AC-ENRL-004.11: unsupported positions do not read requests or fall back to Registrar", async () => {
    const source = createMockReviewDataSource(me.id, "registrar");
    const read = vi.spyOn(source, "list");
    openPage("finance", source);
    await screen.findByRole("heading", { name: "Not available to your role" });
    expect(read).not.toHaveBeenCalled();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("AC-ENRL-004.1: search, status, dates, pagination and keyboard tabs work with wire fixtures", async () => {
    openPage("chairperson");
    await screen.findByRole("table");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Daniel Ramos")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search requests", { exact: true }), "Andrea");
    expect(screen.getByText("1 request found with current filters")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await user.selectOptions(screen.getByLabelText("Status", { exact: true }), "APPROVED");
    expect(screen.getByText("Sofia Garcia")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await user.type(screen.getByLabelText("Filed from", { exact: true }), "2026-11-03");
    expect(screen.getByText("2 requests found with current filters")).toBeInTheDocument();
    screen.getByRole("tab", { name: "Add and drop" }).focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Waivers" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Waivers" })).toHaveAttribute("aria-selected", "true");
  });

  it("AC-ENRL-004.5: rejection requires remarks and sends only the add/drop decision body", async () => {
    const source = openPage("chairperson");
    const decide = vi.spyOn(source, "decide");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: `Review request ${firstAddDrop}` }));
    const dialog = within(screen.getByRole("dialog"));
    await user.click(dialog.getByRole("radio", { name: "Reject request" }));
    await user.click(dialog.getByRole("button", { name: "Confirm decision" }));
    expect(dialog.getByRole("alert")).toHaveTextContent("Give a reason for the rejection.");
    expect(decide).not.toHaveBeenCalled();
    await user.type(dialog.getByLabelText(/Remarks/), "Schedule conflict remains unresolved.");
    await user.click(dialog.getByRole("button", { name: "Confirm decision" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(decide).toHaveBeenCalledWith({
      kind: "add-drop",
      requestId: firstAddDrop,
      body: { decision: "REJECT", remarks: "Schedule conflict remains unresolved.", version: 1 },
    });
  });

  it.each([
    ["DECISION_REMARKS_REQUIRED", "Give a reason for the rejection.", "AC-ENRL-004.5"],
    ["REQUEST_ALREADY_DECIDED", "This request has already been decided.", "AC-ENRL-004.6"],
    ["ENROLL_WAIVER_STEP_MISMATCH", "This waiver is not at your step.", "AC-ENRL-004.11"],
    ["RESOURCE_NOT_FOUND", "This request is no longer available.", "AC-ENRL-004.9"],
  ] as const)("%s: displays backend feedback (%s, %s)", async (code, message, _ac) => {
    const source = createMockReviewDataSource(me.id, "chairperson");
    const read = source.list.bind(source);
    let unavailable = false;
    source.list = async (kind, signal) =>
      unavailable ? { items: [], total: 0 } : read(kind, signal);
    source.decide = vi.fn(async () => {
      unavailable = code === "RESOURCE_NOT_FOUND";
      throw new ApiError(
        code === "RESOURCE_NOT_FOUND" ? 404 : code === "DECISION_REMARKS_REQUIRED" ? 422 : 409,
        code,
      );
    });
    openPage("chairperson", source);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: `Review request ${firstAddDrop}` }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("radio", { name: "Approve request" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm decision" }),
    );
    await waitFor(() =>
      expect(screen.getAllByText((text) => text.includes(message)).length).toBeGreaterThan(0),
    );
    if (code === "REQUEST_ALREADY_DECIDED" || code === "ENROLL_WAIVER_STEP_MISMATCH") {
      const row = screen
        .getByRole("button", { name: `View request ${firstAddDrop}` })
        .closest("tr")!;
      expect(within(row).getByRole("status")).toHaveTextContent(message);
    }
    if (code === "DECISION_REMARKS_REQUIRED")
      expect(within(screen.getByRole("dialog")).getByLabelText(/Remarks/)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    if (code === "RESOURCE_NOT_FOUND")
      await screen.findByRole("heading", { name: "No requests to review" });
  });

  it("AC-ENRL-004.1: renders loading and empty states", async () => {
    let finish!: (value: { items: []; total: number }) => void;
    const source = createMockReviewDataSource(me.id, "chairperson");
    source.list = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    openPage("chairperson", source);
    await screen.findByText("Loading enrollment requests");
    finish({ items: [], total: 0 });
    await screen.findByRole("heading", { name: "No requests to review" });
    expect(screen.queryByText("Andrea Reyes")).not.toBeInTheDocument();
  });

  it("AC-ENRL-004.1: failed loads have an explicit retry", async () => {
    const source = createMockReviewDataSource(me.id, "chairperson");
    const read = source.list.bind(source);
    const load = vi
      .spyOn(source, "list")
      .mockRejectedValueOnce(new ApiError(503, "SERVICE_UNAVAILABLE"))
      .mockImplementation(read);
    // mockImplementation replaces the default, while the one-shot rejection remains first.
    openPage("chairperson", source);
    await screen.findByText("Requests could not be loaded");
    await userEvent.setup().click(screen.getByRole("button", { name: /retry|try again/i }));
    await screen.findByRole("table");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it.each([true, false])("AC-ENRL-004.2: local-only wording follows isMock=%s", async (isMock) => {
    const source = createMockReviewDataSource(me.id, "chairperson");
    openPage("chairperson", { ...source, isMock });
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: `Review request ${firstAddDrop}` }));
    const wording = within(screen.getByRole("dialog")).queryByText(
      /Changes are local to this session/,
    );
    expect(Boolean(wording)).toBe(isMock);
  });

  it("AC-ENRL-004.11: Registrar waiver reference is required and no version is sent", async () => {
    const source = createMockReviewDataSource(me.id, "registrar");
    const decide = vi.spyOn(source, "decide");
    openPage("registrar", source);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Waivers" }));
    const requestId = "30000000-0000-4000-8000-000000000003";
    await user.click(await screen.findByRole("button", { name: `Review request ${requestId}` }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Graduating student")).toBeInTheDocument();
    expect(dialog.queryByText("Review history")).not.toBeInTheDocument();
    expect(dialog.queryByText("Current load")).not.toBeInTheDocument();
    await user.click(dialog.getByRole("radio", { name: "Record VPAA approval" }));
    await user.click(dialog.getByRole("button", { name: "Confirm decision" }));
    expect(dialog.getByRole("alert")).toHaveTextContent("Enter the VPAA approval reference.");
    await user.type(dialog.getByLabelText(/VPAA approval reference/), "VPAA-DEMO-123");
    await user.click(dialog.getByRole("button", { name: "Confirm decision" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(decide).toHaveBeenCalledWith({
      kind: "waivers",
      requestId,
      body: { decision: "APPROVE", vpaaReference: "VPAA-DEMO-123" },
    });
  });

  it("AC-ENRL-004.11: queue and decision dialog have no axe structure violations", async () => {
    openPage("chairperson");
    await screen.findByRole("table");
    const options = { rules: { "color-contrast": { enabled: false } } };
    // jsdom has no layout. Browser verification covers contrast and native modal focus.
    expect((await axe.run(document.body, options)).violations).toEqual([]);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: `Review request ${firstAddDrop}` }));
    expect((await axe.run(screen.getByRole("dialog"), options)).violations).toEqual([]);
  });
});
