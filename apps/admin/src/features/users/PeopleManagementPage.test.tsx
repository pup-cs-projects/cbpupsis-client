import { createPortalRouter } from "@cbpupsis/account";
import { mockApi } from "@cbpupsis/account/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRoute, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { account, session } from "../../lib/auth";
import { me, signInDirectly } from "../../test/fixtures";
import { PeopleManagementPage } from "./PeopleManagementPage";
import {
  adminScope,
  createAdminPeopleDataSource,
  type AdminPeopleTransport,
  type ManagedPerson,
  type PersonKind,
} from "./dataSource";

const person: ManagedPerson = {
  id: "person-1",
  kind: "student",
  fullName: "Test Student",
  email: "student@example.com",
  institutionalId: "2026-00001-CS-0",
  programCode: "BSCS",
  yearLevel: 1,
  departmentId: "CS",
  collegeId: "CCIS",
  active: true,
  roleIds: ["student", "protected-role"],
  permissionIds: [],
};
function setup(kind: PersonKind = "student", position = "chairperson", configured = true) {
  signInDirectly();
  const api = mockApi({
    "GET /admin/me": {
      status: 200,
      body: { ...me, position, department_id: "CS", college_id: "CCIS" },
    },
    "GET /users/me": { status: 200, body: { full_name: "Admin", display_name: "Admin" } },
    "GET /admin/catalog/courses": { status: 403, body: {} },
  });
  const row = { ...person, kind, fullName: kind === "student" ? "Test Student" : "Test Faculty" };
  const transport: AdminPeopleTransport = {
    list: vi.fn().mockResolvedValue({
      items: [row],
      total: 1,
      capabilities: {
        create: true,
        edit: true,
        assignRoles: true,
        roles: [{ id: "assistant", name: "Department Assistant" }],
        permissions: [{ id: "ReadProfile", name: "Read profile" }],
      },
    }),
    save: vi.fn().mockResolvedValue(row),
    assign: vi.fn().mockResolvedValue(row),
  };
  const source = configured ? createAdminPeopleDataSource(transport) : undefined;
  const router = createPortalRouter({
    config: account,
    signIn: () => <p>Sign in</p>,
    dashboard: () => <p>Dashboard</p>,
    extraRoutes: (root) => [
      createRoute({
        getParentRoute: () => root,
        path: "/users/people",
        component: () => <PeopleManagementPage kind={kind} dataSource={source} />,
      }),
    ],
    history: createMemoryHistory({ initialEntries: ["/users/people"] }),
  });
  const view = render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, api, transport };
}
beforeEach(() => vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null));
afterEach(async () => {
  cleanup();
  mockApi({ "POST /auth/admin/logout": { status: 204 } });
  await session.signOut();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("admin Student and Faculty Management integration boundary", () => {
  it.each(["student", "faculty"] as const)(
    "%s management stays in admin with an honest unavailable state and no Superadmin calls",
    async (kind) => {
      const { api, transport, container } = setup(kind, "registrar", false);
      await screen.findByText(/Account and permission changes are disabled/);
      expect(screen.getByRole("button", { name: `Add ${kind}` })).toBeDisabled();
      expect(transport.list).not.toHaveBeenCalled();
      expect(
        api.calls.some(
          (call) => call.route.includes("/admin/users") || call.route.includes("/iam"),
        ),
      ).toBe(false);
      expect(
        (await axe.run(container, { rules: { "color-contrast": { enabled: false } } })).violations,
      ).toEqual([]);
    },
  );
  it.each([
    ["registrar", { kind: "institution" }],
    ["dean", { kind: "college", collegeId: "CCIS" }],
    ["chairperson", { kind: "department", departmentId: "CS" }],
  ] as const)(
    "%s passes its signed-in scope to the future transport without filtering returned records",
    async (position, scope) => {
      const { transport } = setup("student", position);
      await screen.findByRole("rowheader", { name: "Test Student" });
      expect(transport.list).toHaveBeenCalledWith(
        "student",
        scope,
        expect.objectContaining({ offset: 0, limit: 20 }),
        expect.any(AbortSignal),
      );
    },
  );
  it("can assign only the server-advertised roles and permissions while preserving protected assignments", async () => {
    const { transport } = setup();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "Roles and permissions: Test Student" }),
    );
    await user.click(screen.getByRole("checkbox", { name: "Department Assistant" }));
    await user.click(screen.getByRole("checkbox", { name: "Read profile" }));
    await user.click(screen.getByRole("button", { name: "Save roles and permissions" }));
    await screen.findByText("Roles and permissions saved.");
    expect(transport.assign).toHaveBeenCalledWith(
      "student",
      { kind: "department", departmentId: "CS" },
      "person-1",
      {
        addRoleIds: ["assistant"],
        removeRoleIds: [],
        grantPermissionIds: ["ReadProfile"],
        revokePermissionIds: [],
      },
    );
  });
  it("prepares student creation without role or scope fields that could escalate access", async () => {
    const { transport } = setup();
    const user = userEvent.setup();
    const add = await screen.findByRole("button", { name: "Add student" });
    await waitFor(() => expect(add).toBeEnabled());
    await user.click(add);
    await user.type(screen.getByLabelText("Full name"), "New Student");
    await user.type(screen.getByLabelText("Email address"), "new@example.com");
    await user.type(screen.getByLabelText("Student number"), "2026-00002-CS-0");
    await user.type(screen.getByLabelText("Program code"), "BSCS");
    await user.click(screen.getByRole("button", { name: "Save account" }));
    await screen.findByText("Account saved.");
    expect(transport.save).toHaveBeenCalledWith(
      "student",
      { kind: "department", departmentId: "CS" },
      {
        fullName: "New Student",
        email: "new@example.com",
        institutionalId: "2026-00002-CS-0",
        programCode: "BSCS",
        yearLevel: 1,
      },
      undefined,
    );
  });
  it("refuses an out-of-department response instead of displaying another department's user", async () => {
    const transport = {
      list: vi.fn().mockResolvedValue({ items: [{ ...person, departmentId: "IT" }], total: 1 }),
      save: vi.fn(),
      assign: vi.fn(),
    };
    const source = createAdminPeopleDataSource(transport);
    await expect(
      source.list(
        "student",
        { kind: "department", departmentId: "CS" },
        { search: "", active: "all", limit: 20, offset: 0 },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });
  it("never broadens a missing Dean or Chair scope to institution-wide access", () => {
    for (const position of ["dean", "chairperson"] as const)
      expect(() =>
        adminScope({ id: me.id, email: me.email, position, collegeId: null, departmentId: null }),
      ).toThrow();
  });
});
