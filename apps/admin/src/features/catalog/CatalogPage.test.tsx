import { mockApi } from "@cbpupsis/account/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppRouter } from "../../app/router";
import { session } from "../../lib/auth";
import { courseWire, pageWire } from "../../test/adminApiFixtures";
import { me, signInDirectly } from "../../test/fixtures";

const studentId = "10000000-0000-4000-8000-000000000007";
const otherCourseId = "10000000-0000-4000-8000-000000000008";
const versionId = "10000000-0000-4000-8000-000000000009";
function open(position = "chairperson", routes: Parameters<typeof mockApi>[0] = {}) {
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
    "GET /admin/catalog/courses": { status: 200, body: pageWire([courseWire]) },
    ...routes,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createAppRouter(createMemoryHistory({ initialEntries: ["/catalog"] }));
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, api };
}
beforeEach(() => vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null));
afterEach(async () => {
  cleanup();
  mockApi({ "POST /auth/admin/logout": { status: 204 } });
  await session.signOut();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("US-ENRL-005 shared catalog", () => {
  it.each(["chairperson", "dean", "registrar"])(
    "AC-ENRL-005.1 / AC-ENRL-005.3 / AC-ENRL-005.5 / AC-ENRL-005.7: %s has the correct controls and server-owned scope",
    async (position) => {
      const { api, container } = open(position);
      await screen.findByRole("tab", { name: "Courses" });
      await screen.findByText("Introduction to Computing");
      const chair = position === "chairperson";
      expect(Boolean(screen.queryByRole("button", { name: "Create course" }))).toBe(chair);
      expect(Boolean(screen.queryByRole("button", { name: "Edit COMP 001" }))).toBe(chair);
      expect(
        screen.getByText(
          chair
            ? "Department: CS"
            : position === "dean"
              ? "College: CCIS"
              : "All colleges and departments",
        ),
      ).toBeInTheDocument();
      const user = userEvent.setup();
      for (const [tab, action] of [
        ["Curricula", "Publish curriculum version"],
        ["Sections", "Save section"],
        ["Substitutions", "Approve substitution"],
      ]) {
        await user.click(screen.getByRole("tab", { name: tab }));
        expect(Boolean(screen.queryByRole("button", { name: action }))).toBe(chair);
      }
      // Scope comes from the authenticated backend, never a caller-selected department filter.
      for (const call of vi.mocked(fetch).mock.calls) {
        const url = new URL(String(call[0]));
        expect(url.searchParams.has("departmentId")).toBe(false);
        expect(url.searchParams.has("collegeId")).toBe(false);
      }
      expect(
        api.calls
          .filter((call) => call.route.startsWith("GET /admin/catalog/"))
          .every((call) => call.route === "GET /admin/catalog/courses"),
      ).toBe(true);
      expect(
        (await axe.run(container, { rules: { "color-contrast": { enabled: false } } })).violations,
      ).toEqual([]);
    },
  );
  it("AC-ENRL-005.8: Finance cannot open catalog or call its APIs", async () => {
    const { api } = open("finance");
    await screen.findByText("This page is not available to your role.");
    expect(api.called("GET /admin/catalog/courses")).toHaveLength(0);
    expect(screen.queryByRole("link", { name: "Course Management" })).not.toBeInTheDocument();
  });
  it("AC-ENRL-005.8: ReadCatalog refusal hides the navigation and offers no writes", async () => {
    open("chairperson", {
      "GET /admin/catalog/courses": { status: 403, body: { code: "PERMISSION_DENIED" } },
    });
    await screen.findByText("This page is not available to your role.");
    expect(screen.queryByRole("button", { name: "Create course" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Course Management" })).not.toBeInTheDocument();
  });
  it("AC-ENRL-005.2: shows the dependency cycle next to the prerequisite field and preserves entries", async () => {
    const { api } = open("chairperson", {
      "POST /admin/catalog/courses": {
        status: 422,
        body: {
          code: "CATALOG_PREREQUISITE_CYCLE",
          details: { cycle: ["CS101", "CS102", "CS101"] },
        },
      },
    });
    const user = userEvent.setup();
    const create = await screen.findByRole("button", { name: "Create course" });
    await waitFor(() => expect(create).toBeEnabled());
    await user.click(create);
    await user.type(screen.getByLabelText("Course code"), "CS101");
    await user.type(screen.getByLabelText("Course title"), "Computing");
    await user.type(screen.getByLabelText("Prerequisite course codes (comma separated)"), "CS102");
    await user.click(screen.getByRole("button", { name: "Save course" }));
    await screen.findByText("CS101 requires CS102 requires CS101");
    expect(screen.getByLabelText("Prerequisite course codes (comma separated)")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Course code")).toHaveValue("CS101");
    expect(api.called("POST /admin/catalog/courses")[0]!.body).toMatchObject({
      prerequisiteIds: ["CS102"],
    });
  });
  it("AC-ENRL-005.4: publishing uses the API and deletion preserves an in-use version", async () => {
    const route = `DELETE /admin/catalog/curricula/BSCS/versions/${versionId}`;
    const { api } = open("chairperson", {
      "POST /admin/catalog/curricula/BSCS/versions": {
        status: 201,
        body: { id: versionId, programCode: "BSCS", curriculumYear: "2026" },
      },
      [route]: {
        status: 409,
        body: {
          code: "CATALOG_VERSION_IN_USE",
          detail: "This curriculum version has enrolled students.",
        },
      },
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Curricula" }));
    await user.type(screen.getByLabelText("Program code"), "BSCS");
    await user.type(screen.getByLabelText("Version name"), "2026");
    await user.type(screen.getByLabelText("Effective admission year"), "2026");
    await user.type(screen.getByLabelText("Course 1 code"), "COMP 001");
    await user.click(screen.getByRole("button", { name: "Publish curriculum version" }));
    await screen.findByRole("heading", { name: "Published version" });
    await user.click(screen.getByRole("button", { name: "Delete this version" }));
    expect(api.called(route)).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Confirm deletion" }));
    await screen.findByText("This curriculum version has enrolled students.");
    expect(screen.getByRole("heading", { name: "Published version" })).toBeInTheDocument();
    expect(api.called(route)).toHaveLength(1);
  });
  it("AC-ENRL-005.6: capacity refusal is beside Save section without losing the form", async () => {
    const id = "10000000-0000-4000-8000-000000000010";
    const { api } = open("chairperson", {
      [`PATCH /admin/catalog/sections/${id}`]: {
        status: 409,
        body: {
          code: "SECTION_CAPACITY_BELOW_ENROLLED",
          detail: "There are already 30 students enrolled.",
        },
      },
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Sections" }));
    await user.click(screen.getByRole("button", { name: "Update section" }));
    await user.type(screen.getByLabelText("Existing section reference"), id);
    await user.type(screen.getByLabelText("Section name"), "BSCS 1-1");
    await user.type(screen.getByLabelText("Capacity"), "20");
    await user.click(screen.getByRole("button", { name: "Save section" }));
    await screen.findByText("There are already 30 students enrolled.");
    expect(screen.getByLabelText("Capacity")).toHaveValue(20);
    expect(api.called(`PATCH /admin/catalog/sections/${id}`)[0]!.body).toEqual({
      sectionName: "BSCS 1-1",
      capacity: 20,
    });
  });
  it("AC-ENRL-005.7 / AC-ENRL-005.8: approves a substitution and reads server degree progress", async () => {
    const { api } = open("chairperson", {
      "POST /admin/catalog/substitutions": {
        status: 201,
        body: {
          originalCourseId: courseWire.id,
          substituteCourseId: otherCourseId,
          studentIds: [studentId],
        },
      },
      [`GET /admin/catalog/students/${studentId}/degree-progress`]: {
        status: 200,
        body: {
          studentId,
          completedUnits: "3",
          totalUnitsRequired: "120",
          courses: [
            {
              courseId: courseWire.id,
              courseCode: "COMP 001",
              title: "Computing",
              units: "3",
              completed: true,
              substitutedByCourseCode: "COMP 002",
            },
          ],
        },
      },
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "Substitutions" }));
    await user.type(screen.getByLabelText("Original course reference"), courseWire.id);
    await user.type(screen.getByLabelText("Substitute course reference"), otherCourseId);
    await user.type(
      screen.getByLabelText("Student account references (comma separated)"),
      studentId,
    );
    await user.click(screen.getByRole("button", { name: "Approve substitution" }));
    await screen.findByText("Substitution approved for 1 student.");
    expect(api.called("POST /admin/catalog/substitutions")[0]!.body).toEqual({
      originalCourseId: courseWire.id,
      substituteCourseId: otherCourseId,
      studentIds: [studentId],
    });
    await user.type(screen.getByLabelText("Student account reference"), studentId);
    await user.click(screen.getByRole("button", { name: "View degree progress" }));
    await screen.findByText("3 of 120 units completed");
    expect(within(screen.getByRole("table")).getByText("COMP 002")).toBeInTheDocument();
  });
  it("AC-ENRL-005.8: tabs are keyboard reachable and preserve correct tab semantics", async () => {
    open();
    const user = userEvent.setup();
    const courses = await screen.findByRole("tab", { name: "Courses" });
    courses.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Curricula" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Substitutions" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{Home}");
    expect(courses).toHaveFocus();
  });
  it("AC-ENRL-005.8: empty courses are truthful and never trigger missing list endpoints", async () => {
    const { api } = open("registrar", {
      "GET /admin/catalog/courses": { status: 200, body: pageWire([]) },
    });
    await screen.findByText("No courses match your search.");
    await userEvent.setup().click(screen.getByRole("tab", { name: "Curricula" }));
    await screen.findByText(/Curriculum versions are not available for browsing yet/);
    expect(
      api.calls
        .filter((call) => call.route.startsWith("GET /admin/catalog/"))
        .every((call) => call.route === "GET /admin/catalog/courses"),
    ).toBe(true);
  });
  it("AC-ENRL-005.8: failed reads offer a retry", async () => {
    open("registrar", {
      "GET /admin/catalog/courses": [
        { status: 503, body: {} },
        { status: 200, body: pageWire([courseWire]) },
      ],
    });
    await screen.findByRole("button", { name: "Retry" });
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Introduction to Computing");
  });
});
