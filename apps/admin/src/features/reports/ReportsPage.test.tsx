import { createPortalRouter } from "@cbpupsis/account";
import { mockApi } from "@cbpupsis/account/testing";
import { ApiError } from "@cbpupsis/shared/api";
import type { EnrollmentReport, EnrollmentReportFilters } from "@cbpupsis/shared/reports";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRoute, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { account, session } from "../../lib/auth";
import { me, signInDirectly } from "../../test/fixtures";
import { termsFrom, type ReportsDataSource, type TermOption } from "./dataSource";
import { ReportsPage } from "./ReportsPage";

const TERM = "30000000-0000-4000-8000-000000000001";
const terms: TermOption[] = [{ id: TERM, label: "2026-2027 First Semester" }];
const byProgram: EnrollmentReport = {
  rows: [
    { group: "BSCS", count: 120 },
    { group: "BSIT", count: 80 },
  ],
  total: 200,
};
const byYear: EnrollmentReport = {
  rows: [
    { group: "1", count: 70 },
    { group: "2", count: 50 },
  ],
  total: 120,
};

function sourceFor(
  overrides: Partial<{
    terms: TermOption[];
    report: (filters: EnrollmentReportFilters) => Promise<EnrollmentReport>;
  }> = {},
) {
  const source: ReportsDataSource = {
    terms: vi.fn(() => Promise.resolve(overrides.terms ?? terms)),
    enrollment: vi.fn((filters: EnrollmentReportFilters) =>
      overrides.report
        ? overrides.report(filters)
        : Promise.resolve(filters.groupBy === "program" ? byProgram : byYear),
    ),
    exportEnrollment: vi.fn(() => Promise.resolve(new Blob(["group,count\n"]))),
  };
  return source;
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(async () => {
  cleanup();
  await session.signOut();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function openPage(position: string, source: ReportsDataSource = sourceFor()) {
  signInDirectly();
  mockApi({
    "GET /admin/me": {
      status: 200,
      body: { ...me, position, college_id: "college-1", department_id: "dept-1" },
    },
    "GET /users/me": { status: 200, body: { full_name: "Admin User", email: me.email } },
    "POST /auth/admin/logout": { status: 204 },
  });
  const router = createPortalRouter({
    config: account,
    signIn: () => <p>Sign in</p>,
    dashboard: () => <p>Dashboard</p>,
    history: createMemoryHistory({ initialEntries: ["/reports"] }),
    extraRoutes: (root) => [
      createRoute({
        getParentRoute: () => root,
        path: "/reports",
        component: () => <ReportsPage dataSource={source} />,
      }),
    ],
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    ...render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    source,
    user: userEvent.setup(),
  };
}

async function generate(view: ReturnType<typeof openPage>) {
  await view.user.selectOptions(await screen.findByLabelText("Term *"), TERM);
  await view.user.click(screen.getByRole("button", { name: "Generate report" }));
  await screen.findByRole("table");
}

describe("Reports page, Enrollment tab (US-RPT-001)", () => {
  it.each([
    ["chairperson", "Students in your department"],
    ["dean", "Students in your college"],
    ["registrar", "All students"],
  ])("AC-RPT-001.4: %s sees the Enrollment tab with their own scope", async (position, scope) => {
    openPage(position);
    expect(await screen.findByRole("tab", { name: "Enrollment" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText(new RegExp(scope))).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getAllByRole("button", { name: "Reports" })[0]!);
    expect(await screen.findByRole("link", { name: "Enrollment" })).toHaveAttribute(
      "href",
      "/reports",
    );
  });

  it("AC-RPT-001.4: finance sees no Enrollment tab and loads no report data", async () => {
    const { source } = openPage("finance");
    expect(await screen.findByText("No reports are available to your role.")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getAllByRole("button", { name: "Reports" })[0]!);
    expect(screen.queryByRole("link", { name: "Enrollment" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enrollment, coming soon" })).toBeInTheDocument();
    expect(source.terms).not.toHaveBeenCalled();
    expect(source.enrollment).not.toHaveBeenCalled();
  });

  it("AC-RPT-001.1: generates counts with a total, a chart, and the group-by picker", async () => {
    const view = openPage("registrar");
    await view.user.type(await screen.findByLabelText("Program code"), "BSCS");
    await view.user.selectOptions(screen.getByLabelText("Enrollment status"), "enrolled");
    await generate(view);
    expect(view.source.enrollment).toHaveBeenLastCalledWith(
      { termId: TERM, groupBy: "program", programCode: "BSCS", status: "enrolled" },
      expect.anything(),
    );
    const table = screen.getByRole("table");
    expect(within(table).getByRole("rowheader", { name: "BSCS" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "Total" })).toBeInTheDocument();
    expect(within(table).getAllByText("200")).toHaveLength(1);
    expect(screen.getByTestId("enrollment-chart")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("The table below lists the same numbers.")).toBeInTheDocument();

    for (const groupBy of ["status", "yearLevel", "sex", "section"] as const) {
      await view.user.selectOptions(screen.getByLabelText("Group by"), groupBy);
      await waitFor(() =>
        expect(view.source.enrollment).toHaveBeenLastCalledWith(
          expect.objectContaining({ groupBy }),
          expect.anything(),
        ),
      );
    }
  });

  it("AC-RPT-001.2: a program row drills down to year level and section", async () => {
    const view = openPage("dean");
    await generate(view);
    await view.user.click(screen.getByRole("button", { name: "Details for BSCS" }));
    expect(await screen.findByRole("heading", { name: "Program BSCS" })).toBeInTheDocument();
    expect(view.source.enrollment).toHaveBeenLastCalledWith(
      { termId: TERM, groupBy: "yearLevel", programCode: "BSCS" },
      expect.anything(),
    );
    expect(await screen.findByRole("rowheader", { name: "Year 1" })).toBeInTheDocument();
    const picker = screen.getByLabelText("Group by");
    expect(
      within(picker)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["By year level", "By section"]);
    await view.user.selectOptions(picker, "section");
    await waitFor(() =>
      expect(view.source.enrollment).toHaveBeenLastCalledWith(
        { termId: TERM, groupBy: "section", programCode: "BSCS" },
        expect.anything(),
      ),
    );
    await view.user.click(screen.getByRole("button", { name: "Back to all programs" }));
    expect(await screen.findByRole("heading", { name: "Enrollment counts" })).toBeInTheDocument();
  });

  it.each(["csv", "pdf"] as const)(
    "AC-RPT-001.3: Export %s downloads the report shown on screen",
    async (format) => {
      const createObjectURL = vi.fn(() => "blob:report");
      vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
      const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      const view = openPage("chairperson");
      await generate(view);
      await view.user.click(screen.getByRole("button", { name: "Details for BSIT" }));
      await screen.findByRole("rowheader", { name: "Year 1" });
      await view.user.click(screen.getByRole("button", { name: `Export ${format.toUpperCase()}` }));
      await waitFor(() =>
        expect(view.source.exportEnrollment).toHaveBeenCalledWith(
          { termId: TERM, groupBy: "yearLevel", programCode: "BSIT" },
          format,
        ),
      );
      await waitFor(() => expect(click).toHaveBeenCalled());
      expect(createObjectURL).toHaveBeenCalled();
    },
  );

  it("AC-RPT-001.3: shows the API's refusal when an export fails", async () => {
    const view = openPage("registrar");
    vi.mocked(view.source.exportEnrollment).mockRejectedValueOnce(
      new ApiError(400, "INVALID_INPUT", { detail: "Unknown export format: doc" }),
    );
    await generate(view);
    await view.user.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(await screen.findByText(/Check the filters/)).toBeInTheDocument();
  });

  it("AC-RPT-001.5: a filter with no matches shows an empty state naming the filters", async () => {
    const source = sourceFor({ report: () => Promise.resolve({ rows: [], total: 0 }) });
    const view = openPage("registrar", source);
    await view.user.type(await screen.findByLabelText("Program code"), "BSMATH");
    await view.user.selectOptions(screen.getByLabelText("Term *"), TERM);
    await view.user.click(screen.getByRole("button", { name: "Generate report" }));
    expect(
      await screen.findByText(
        "No enrolled students match these filters: Term: 2026-2027 First Semester, Program: BSMATH, Status: All statuses.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  });

  it("requires a term before generating", async () => {
    const view = openPage("registrar");
    await view.user.click(await screen.findByRole("button", { name: "Generate report" }));
    expect(await screen.findByText("Choose a term.")).toBeInTheDocument();
    expect(screen.getByLabelText("Term *")).toHaveAttribute("aria-invalid", "true");
    expect(view.source.enrollment).not.toHaveBeenCalled();
  });

  it("accepts a typed term ID when no term list is available", async () => {
    const view = openPage("registrar", sourceFor({ terms: [] }));
    await view.user.type(await screen.findByLabelText("Term ID *"), TERM);
    await view.user.click(screen.getByRole("button", { name: "Generate report" }));
    await screen.findByRole("table");
    expect(view.source.enrollment).toHaveBeenCalledWith(
      { termId: TERM, groupBy: "program" },
      expect.anything(),
    );
  });

  it("shows an error with the request id and retries", async () => {
    let calls = 0;
    const source = sourceFor({
      report: () =>
        ++calls === 1
          ? Promise.reject(new ApiError(500, "INTERNAL_ERROR", { requestId: "req-42" }))
          : Promise.resolve(byProgram),
    });
    const view = openPage("registrar", source);
    await view.user.selectOptions(await screen.findByLabelText("Term *"), TERM);
    await view.user.click(screen.getByRole("button", { name: "Generate report" }));
    expect(await screen.findByText("Request ID: req-42")).toBeInTheDocument();
    await view.user.click(screen.getByRole("button", { name: "Retry report" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("names an unknown term from RESOURCE_NOT_FOUND", async () => {
    const source = sourceFor({
      report: () => Promise.reject(new ApiError(404, "RESOURCE_NOT_FOUND")),
    });
    const view = openPage("registrar", source);
    await view.user.selectOptions(await screen.findByLabelText("Term *"), TERM);
    await view.user.click(screen.getByRole("button", { name: "Generate report" }));
    expect(await screen.findByText(/We could not find that term/)).toBeInTheDocument();
  });

  it("hides the tab when the API answers AUTH_INSUFFICIENT_ROLE", async () => {
    const source = sourceFor({
      report: () => Promise.reject(new ApiError(403, "AUTH_INSUFFICIENT_ROLE")),
    });
    const view = openPage("dean", source);
    await view.user.selectOptions(await screen.findByLabelText("Term *"), TERM);
    await view.user.click(screen.getByRole("button", { name: "Generate report" }));
    expect(await screen.findByText("No reports are available to your role.")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("has no axe violations with a generated report", async () => {
    const view = openPage("registrar");
    await generate(view);
    expect(
      (await axe.run(view.container, { rules: { "color-contrast": { enabled: false } } }))
        .violations,
    ).toEqual([]);
  });

  it("lists each term once, newest label first", () => {
    expect(
      termsFrom([
        { academicTermId: "a", term: "2025-2026 Second Semester" },
        { academicTermId: "b", term: "2026-2027 First Semester" },
        { academicTermId: "a", term: "2025-2026 Second Semester" },
      ]),
    ).toEqual([
      { id: "b", label: "2026-2027 First Semester" },
      { id: "a", label: "2025-2026 Second Semester" },
    ]);
  });
});
