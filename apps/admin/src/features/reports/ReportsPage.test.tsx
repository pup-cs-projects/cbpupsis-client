import { mockApi } from "@cbpupsis/account/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppRouter } from "../../app/router";
import { session } from "../../lib/auth";
import { me, signInDirectly } from "../../test/fixtures";
import { termId, pageWire } from "../../test/adminApiFixtures";

const READ = "GET /admin/reports/enrollment";
const EXPORT = "GET /admin/reports/enrollment/export";
const body = {
  rows: [
    { group: "BSCS", count: 4 },
    { group: "BSIT", count: 3 },
  ],
  total: 7,
};
let restoreFiles: () => void;
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const create = Object.getOwnPropertyDescriptor(URL, "createObjectURL"),
    revoke = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
  Object.defineProperties(URL, {
    createObjectURL: { configurable: true, value: vi.fn(() => "blob:report-test") },
    revokeObjectURL: { configurable: true, value: vi.fn() },
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  restoreFiles = () => {
    for (const [name, value] of [
      ["createObjectURL", create],
      ["revokeObjectURL", revoke],
    ] as const) {
      if (value) Object.defineProperty(URL, name, value);
      else Reflect.deleteProperty(URL, name);
    }
  };
});
afterEach(async () => {
  cleanup();
  restoreFiles();
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
      body: {
        ...me,
        position,
        department_id: position === "chairperson" ? "CS" : null,
        college_id: position === "dean" ? "CCIS" : null,
      },
    },
    "GET /users/me": { status: 200, body: { full_name: "Test Admin", display_name: "Test Admin" } },
    "GET /admin/catalog/courses": { status: 200, body: pageWire([]) },
    [READ]: { status: 200, body },
    [EXPORT]: { status: 200, body: "synthetic report", headers: { "Content-Type": "text/csv" } },
    ...routes,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createAppRouter(createMemoryHistory({ initialEntries: ["/reports"] }));
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, api, client };
}
async function generate() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Academic term reference"), termId);
  await user.click(screen.getByRole("button", { name: "Generate report" }));
  return user;
}

describe("ReportsPage US-RPT-001", () => {
  it.each(["chairperson", "dean", "registrar"])(
    "AC-RPT-001.1 / AC-RPT-001.4: %s sees Enrollment and the API owns its scope",
    async (position) => {
      const { api, container } = open(position);
      await screen.findByRole("tab", { name: "Enrollment" });
      await generate();
      await screen.findByText("7 enrollment records");
      expect(screen.getByRole("figure", { name: "Enrollment distribution" })).toBeInTheDocument();
      const table = screen.getByRole("table", { name: "Enrollment counts" });
      expect(within(table).getByRole("rowheader", { name: "Total" })).toBeInTheDocument();
      expect(api.called(READ)).toHaveLength(1);
      for (const call of vi.mocked(fetch).mock.calls) {
        const url = new URL(String(call[0]));
        expect(url.searchParams.has("department")).toBe(false);
        expect(url.searchParams.has("college")).toBe(false);
      }
      expect(
        (await axe.run(container, { rules: { "color-contrast": { enabled: false } } })).violations,
      ).toEqual([]);
    },
  );
  it("AC-RPT-001.4: Finance has no Enrollment tab, report controls, or report API calls", async () => {
    const { api } = open("finance");
    await screen.findByText("Enrollment reports are not available to your role.");
    expect(screen.queryByRole("tab", { name: "Enrollment" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate report" })).not.toBeInTheDocument();
    expect(api.called(READ)).toHaveLength(0);
  });
  it("AC-RPT-001.4: a permission refusal removes the tab without exposing internal permissions", async () => {
    open("chairperson", {
      [READ]: { status: 403, body: { detail: "Missing ReadEnrollmentReport" } },
    });
    await generate();
    await screen.findByText(/Your account does not have permission to view Enrollment reports/);
    expect(screen.queryByRole("tab", { name: "Enrollment" })).not.toBeInTheDocument();
    expect(screen.queryByText("Missing ReadEnrollmentReport")).not.toBeInTheDocument();
  });
  it("AC-RPT-001.2: a program bar drills into year levels and sections without inventing filters", async () => {
    const api = open("registrar", {
      [READ]: [
        { status: 200, body },
        { status: 200, body: { rows: [{ group: "1", count: 4 }], total: 4 } },
        { status: 200, body: { rows: [{ group: "BSCS 1-1", count: 4 }], total: 4 } },
        { status: 200, body },
      ],
    });
    const user = await generate();
    await screen.findByText("7 enrollment records");
    await user.click(
      screen.getByRole("button", {
        name: /BSCS.*4.*View year levels and sections/,
      }),
    );
    await screen.findByText("4 enrollment records");
    expect(screen.getByLabelText("Group by")).toHaveValue("yearLevel");
    await user.click(screen.getByRole("button", { name: "View sections" }));
    await within(screen.getByRole("table")).findByText("BSCS 1-1");
    await user.click(screen.getByRole("button", { name: "Back to program summary" }));
    await screen.findByText("7 enrollment records");
    const urls = vi
      .mocked(fetch)
      .mock.calls.map(([url]) => new URL(String(url)))
      .filter((url) => url.pathname.endsWith("/reports/enrollment"));
    expect(
      urls.map((url) => [url.searchParams.get("groupBy"), url.searchParams.get("programCode")]),
    ).toEqual([
      ["program", null],
      ["yearLevel", "BSCS"],
      ["section", "BSCS"],
      ["program", null],
    ]);
    expect(api.api.called(READ)).toHaveLength(4);
  });
  it("AC-RPT-001.2: a program table row is keyboard actionable", async () => {
    open("registrar", {
      [READ]: [
        { status: 200, body },
        { status: 200, body: { rows: [{ group: "1", count: 4 }], total: 4 } },
      ],
    });
    const user = await generate();
    await screen.findByText("7 enrollment records");
    const row = within(screen.getByRole("table")).getByRole("button", {
      name: "BSCS: view year levels and sections",
    });
    row.focus();
    await user.keyboard("{Enter}");
    await screen.findByText("4 enrollment records");
    expect(screen.getByLabelText("Group by")).toHaveValue("yearLevel");
  });
  it.each(["CSV", "PDF"])(
    "AC-RPT-001.3: Export %s downloads the displayed report rather than unsubmitted filter edits",
    async (format) => {
      open();
      const user = await generate();
      await screen.findByText("7 enrollment records");
      await user.type(screen.getByLabelText("Program code (optional)"), "UNSUBMITTED");
      await user.click(screen.getByRole("button", { name: `Export ${format}` }));
      await screen.findByText(`Enrollment report ${format} is downloading.`);
      const urls = vi
        .mocked(fetch)
        .mock.calls.map(([url]) => new URL(String(url)))
        .filter((url) => url.pathname.includes("/reports/enrollment"));
      expect(urls[1]!.pathname).toBe("/api/v1/admin/reports/enrollment/export");
      expect(urls[1]!.searchParams.get("format")).toBe(format.toLowerCase());
      expect(urls[1]!.searchParams.get("programCode")).toBeNull();
      expect(urls[1]!.searchParams.get("termId")).toBe(termId);
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    },
  );
  it("AC-RPT-001.5: no matches names the applied term, program, and status", async () => {
    open("dean", { [READ]: { status: 200, body: { rows: [], total: 0 } } });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Academic term reference"), termId);
    await user.type(screen.getByLabelText("Program code (optional)"), "BSCS");
    await user.selectOptions(screen.getByLabelText("Enrollment status"), "ENROLLED_PENDING");
    await user.click(screen.getByRole("button", { name: "Generate report" }));
    await screen.findByText(
      `No enrollment records match term ${termId}; program BSCS; status ENROLLED_PENDING.`,
    );
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
  });
  it("AC-RPT-001.1: generating the same filters again reads current server totals", async () => {
    const { api } = open("registrar", {
      [READ]: [
        { status: 200, body },
        { status: 200, body: { rows: [{ group: "BSCS", count: 8 }], total: 8 } },
      ],
    });
    const user = await generate();
    await screen.findByText("7 enrollment records");
    await user.click(screen.getByRole("button", { name: "Generate report" }));
    await screen.findByText("8 enrollment records");
    expect(api.called(READ)).toHaveLength(2);
  });
  it("AC-RPT-001.1: grouping reloads authoritative numbers and changes the export query", async () => {
    open("registrar", {
      [READ]: [
        { status: 200, body },
        { status: 200, body: { rows: [{ group: "OFFICIALLY_ENROLLED", count: 7 }], total: 7 } },
      ],
    });
    const user = await generate();
    await screen.findByText("7 enrollment records");
    await user.selectOptions(screen.getByLabelText("Group by"), "status");
    await within(screen.getByRole("table")).findByText("OFFICIALLY_ENROLLED");
    await user.click(screen.getByRole("button", { name: "Export CSV" }));
    await screen.findByText("Enrollment report CSV is downloading.");
    const url = vi
      .mocked(fetch)
      .mock.calls.map(([url]) => new URL(String(url)))
      .find((url) => url.pathname.endsWith("/enrollment/export"))!;
    expect(url.searchParams.get("groupBy")).toBe("status");
  });
  it("AC-RPT-001.1: loading is announced and failed reads can retry", async () => {
    open("registrar", {
      [READ]: [
        { status: 503, body: {} },
        { status: 200, body },
      ],
    });
    await generate();
    await screen.findByRole("button", { name: "Retry" });
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("7 enrollment records");
  });
  it("AC-RPT-001.1: a pending report disables repeat generation and exports", async () => {
    const { api } = open("registrar", { [READ]: "pending" });
    await generate();
    await screen.findByText("Loading enrollment report…");
    expect(screen.getByRole("button", { name: "Generating…" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
    expect(api.called(READ)).toHaveLength(1);
  });
  it("AC-RPT-001.1: inconsistent totals fail rather than presenting misleading charts", async () => {
    open("registrar", {
      [READ]: { status: 200, body: { rows: [{ group: "BSCS", count: 7 }], total: 100 } },
    });
    await generate();
    await screen.findByText(/unexpected response/);
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
  });
});
