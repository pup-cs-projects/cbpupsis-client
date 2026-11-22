import { createPortalRouter } from "@cbpupsis/account";
import { mockApi } from "@cbpupsis/account/testing";
import { ApiError } from "@cbpupsis/shared/api";
import type { CatalogCourse, CatalogCoursePage } from "@cbpupsis/shared/catalog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRoute, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, expect, it, vi } from "vitest";

import { account, session } from "../../lib/auth";
import { me, signInDirectly } from "../../test/fixtures";
import { DashboardLayout } from "../dashboard/DashboardLayout";
import { CatalogPage } from "./CatalogPage";
import type { CatalogDataSource } from "./dataSource";

const ids = {
  cs101: "10000000-0000-4000-8000-000000000101",
  cs102: "10000000-0000-4000-8000-000000000102",
  version: "20000000-0000-4000-8000-000000000001",
  section: "30000000-0000-4000-8000-000000000001",
  student: "40000000-0000-4000-8000-000000000001",
};

function course(id: string, code: string, title: string, prerequisites: string[] = []) {
  return {
    id,
    courseCode: code,
    title,
    description: null,
    department: "Computer Science",
    college: "CCIS",
    lectureUnits: "3",
    labUnits: "0",
    totalUnits: "3",
    termOffered: "First Semester",
    isActive: true,
    prerequisiteIds: [],
    corequisiteIds: [],
    prerequisites,
    corequisites: [],
  } satisfies CatalogCourse;
}

const courses = [
  course(ids.cs101, "CS101", "Programming 1"),
  course(ids.cs102, "CS102", "Programming 2", ["CS101"]),
];

function page(items: CatalogCourse[]): CatalogCoursePage {
  return { items, total: items.length, limit: 25, offset: 0 };
}

const section = {
  id: ids.section,
  courseId: ids.cs101,
  academicTermId: "50000000-0000-4000-8000-000000000001",
  facultyId: null,
  sectionName: "BSCS 1-1",
  capacity: 40,
  enrolled: 0,
  seatsLeft: 40,
  room: "S501",
  status: "open",
};

function fakeSource(): CatalogDataSource {
  return {
    listCourses: vi.fn(async () => page(courses)),
    createCourse: vi.fn(async (body) => ({ ...courses[0]!, ...body, id: "new-course" })),
    updateCourse: vi.fn(async (id, body) => ({ ...courses[0]!, ...body, id })),
    publishVersion: vi.fn(async (programCode, body) => ({
      id: ids.version,
      programCode,
      curriculumYear: body.curriculumYear ?? "2026",
      effectiveAdmissionYear: body.effectiveAdmissionYear,
      courseCount: body.courses.length,
    })),
    deleteVersion: vi.fn(async () => undefined),
    createSection: vi.fn(async (body) => ({ ...section, ...body, enrolled: 0 })),
    updateSection: vi.fn(async (id, body) => ({ ...section, ...body, id })),
    approveSubstitution: vi.fn(async (body) => body),
  };
}

afterEach(async () => {
  cleanup();
  await session.signOut();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function open(role: string, source = fakeSource()) {
  signInDirectly();
  mockApi({
    "GET /admin/me": {
      status: 200,
      body: { ...me, position: role, department_id: "dept-1", college_id: "college-1" },
    },
    "GET /users/me": { status: 200, body: { full_name: "Catalog Admin", email: me.email } },
    "POST /auth/admin/logout": { status: 204 },
  });
  const router = createPortalRouter({
    config: account,
    signIn: () => <p>Sign in</p>,
    dashboard: () => (
      <DashboardLayout>
        <p>Dashboard</p>
      </DashboardLayout>
    ),
    history: createMemoryHistory({ initialEntries: ["/catalog"] }),
    extraRoutes: (root) => [
      createRoute({
        getParentRoute: () => root,
        path: "/catalog",
        component: () => <CatalogPage dataSource={source} />,
      }),
    ],
  });
  render(
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
  return { source, user: userEvent.setup() };
}

const editControls = ["New course", "Edit CS101"];

it.each([
  ["chairperson", "Manage Course Catalog", true],
  ["dean", "Course Catalog", false],
  ["registrar", "Course Catalog", false],
] as const)(
  "AC-ENRL-005.8: %s opens the catalog with the edit controls its role allows",
  async (role, heading, editor) => {
    const { source, user } = open(role);
    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    await screen.findByRole("rowheader", { name: "CS101" });
    expect(screen.getByRole("tab", { name: "Courses" })).toHaveAttribute("aria-selected", "true");
    for (const name of editControls) {
      if (editor) expect(screen.getByRole("button", { name })).toBeInTheDocument();
      else expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
    for (const [tab, control] of [
      ["Curricula", "Publish version"],
      ["Sections", "Create section"],
      ["Substitutions", "Approve substitution"],
    ] as const) {
      await user.click(screen.getByRole("tab", { name: tab }));
      if (editor) expect(await screen.findByRole("button", { name: control })).toBeInTheDocument();
      else {
        expect(await screen.findByText(/does not list/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: control })).not.toBeInTheDocument();
      }
    }
    expect(source.listCourses).toHaveBeenCalled();
  },
);

it("AC-ENRL-005.8: other admin positions cannot use the page", async () => {
  const { source } = open("finance");
  expect(await screen.findByText("This page is not available to your role.")).toBeInTheDocument();
  expect(source.listCourses).not.toHaveBeenCalled();
});

it("AC-ENRL-005.8: an API 403 on the list shows the page as unavailable", async () => {
  const source = fakeSource();
  vi.mocked(source.listCourses).mockRejectedValue(new ApiError(403, "AUTH_INSUFFICIENT_ROLE"));
  open("dean", source);
  expect(await screen.findByText("This page is not available to your role.")).toBeInTheDocument();
});

it("AC-ENRL-005.1: a Chair adds a course with prerequisites and term offered", async () => {
  const { source, user } = open("chairperson");
  await user.click(await screen.findByRole("button", { name: "New course" }));
  await user.type(screen.getByLabelText(/^Course code/), "CS103");
  await user.type(screen.getByLabelText(/^Title/), "Data Structures");
  await user.type(screen.getByLabelText("Description"), "Lists, trees, and graphs.");
  await user.selectOptions(screen.getByLabelText("Term offered"), "Second Semester");
  const prerequisites = screen.getByRole("group", { name: "Prerequisites" });
  await user.click(await within(prerequisites).findByLabelText("CS102: Programming 2"));
  const corequisites = screen.getByRole("group", { name: "Co-requisites" });
  await user.click(within(corequisites).getByLabelText("CS101: Programming 1"));
  await user.click(screen.getByRole("button", { name: "Add course" }));
  await waitFor(() =>
    expect(source.createCourse).toHaveBeenCalledWith({
      courseCode: "CS103",
      title: "Data Structures",
      description: "Lists, trees, and graphs.",
      lectureUnits: "3",
      labUnits: "0",
      termOffered: "Second Semester",
      isActive: true,
      prerequisiteIds: [ids.cs102],
      corequisiteIds: [ids.cs101],
    }),
  );
  expect(await screen.findByText(/CS103 saved/)).toBeInTheDocument();
});

it("AC-ENRL-005.1: required course fields are checked before saving", async () => {
  const { source, user } = open("chairperson");
  await user.click(await screen.findByRole("button", { name: "New course" }));
  await user.click(screen.getByRole("button", { name: "Add course" }));
  expect(screen.getByLabelText(/^Course code/)).toHaveAttribute("aria-invalid", "true");
  expect(source.createCourse).not.toHaveBeenCalled();
});

it("AC-ENRL-005.2: a prerequisite cycle is named next to the prerequisite field", async () => {
  const source = fakeSource();
  vi.mocked(source.updateCourse).mockRejectedValue(
    new ApiError(422, "CATALOG_PREREQUISITE_CYCLE", {
      detail: "Prerequisite or co-requisite configuration forms a cycle: CS101 -> CS102 -> CS101.",
      details: { cycle: ["CS101", "CS102", "CS101"] },
      requestId: "req-1",
    }),
  );
  const { user } = open("chairperson", source);
  await user.click(await screen.findByRole("button", { name: "Edit CS101" }));
  const prerequisites = screen.getByRole("group", { name: "Prerequisites" });
  await user.click(await within(prerequisites).findByLabelText("CS102: Programming 2"));
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(
    await within(prerequisites).findByText(/CS101 requires CS102 requires CS101/),
  ).toBeInTheDocument();
  expect(within(prerequisites).getByText("Reference: req-1")).toBeInTheDocument();
});

it("AC-ENRL-005.3: a Chair publishes a new curriculum version for an admission year", async () => {
  const { source, user } = open("chairperson");
  await user.click(await screen.findByRole("tab", { name: "Curricula" }));
  await user.type(await screen.findByLabelText(/^Program code/), "bscs");
  const year = screen.getByLabelText(/^Effective admission year/);
  await user.clear(year);
  await user.type(year, "2027");
  await user.type(screen.getByLabelText("Curriculum year"), "2027-2028");
  await user.selectOptions(await screen.findByLabelText(/^Course 1/), ids.cs101);
  await user.click(screen.getByRole("button", { name: "Publish version" }));
  await waitFor(() =>
    expect(source.publishVersion).toHaveBeenCalledWith("BSCS", {
      effectiveAdmissionYear: 2027,
      curriculumYear: "2027-2028",
      courses: [{ courseId: ids.cs101, yearLevel: 1, semester: "First Semester" }],
    }),
  );
  expect(await screen.findByText(/Earlier students keep their version/)).toBeInTheDocument();
});

it("AC-ENRL-005.4: deleting a version with bound students shows the refusal next to it", async () => {
  const source = fakeSource();
  vi.mocked(source.deleteVersion).mockRejectedValue(
    new ApiError(409, "CATALOG_VERSION_IN_USE", {
      detail: "Cannot delete a curriculum version while students are bound to it.",
    }),
  );
  const { user } = open("chairperson", source);
  await user.click(await screen.findByRole("tab", { name: "Curricula" }));
  await user.type(await screen.findByLabelText(/^Version ID/), ids.version);
  await user.click(screen.getByRole("button", { name: "Delete version" }));
  expect(
    await screen.findByText("Cannot delete a curriculum version while students are bound to it."),
  ).toBeInTheDocument();
  expect(source.deleteVersion).toHaveBeenCalledWith(ids.version);
});

it("AC-ENRL-005.5: a Chair creates a section with faculty, schedule, room, and capacity", async () => {
  const { source, user } = open("chairperson");
  await user.click(await screen.findByRole("tab", { name: "Sections" }));
  await user.selectOptions(await screen.findByLabelText(/^Course/), ids.cs101);
  await user.type(screen.getByLabelText(/^Section name/), "BSCS 1-1");
  await user.type(screen.getByLabelText("Faculty user ID"), ids.student);
  const capacity = screen.getByLabelText(/^Capacity/);
  await user.clear(capacity);
  await user.type(capacity, "35");
  await user.type(screen.getByLabelText("Room"), "S501");
  await user.selectOptions(screen.getByLabelText("Day"), "Wednesday");
  await user.click(screen.getByRole("button", { name: "Create section" }));
  await waitFor(() =>
    expect(source.createSection).toHaveBeenCalledWith({
      courseId: ids.cs101,
      sectionName: "BSCS 1-1",
      facultyId: ids.student,
      capacity: 35,
      room: "S501",
      meetings: [
        {
          dayOfWeek: 2,
          startTime: "08:00:00",
          endTime: "10:00:00",
          room: "S501",
          scheduleType: "lecture",
        },
      ],
    }),
  );
  expect(await screen.findByText(/seats left. Students see it/)).toBeInTheDocument();
});

it("AC-ENRL-005.6: lowering capacity below the enrolled count shows the enrolled count", async () => {
  const source = fakeSource();
  vi.mocked(source.updateSection).mockRejectedValue(
    new ApiError(409, "SECTION_CAPACITY_BELOW_ENROLLED", {
      detail: "Section capacity cannot be set below the currently enrolled count (3).",
      details: { enrolled: 3 },
    }),
  );
  const { user } = open("chairperson", source);
  await user.click(await screen.findByRole("tab", { name: "Sections" }));
  await user.type(await screen.findByLabelText(/^Section ID/), ids.section);
  await user.type(screen.getByLabelText(/^New capacity/), "2");
  await user.click(screen.getByRole("button", { name: "Save section" }));
  expect(
    await screen.findByText(
      "Section capacity cannot be set below the currently enrolled count (3).",
    ),
  ).toBeInTheDocument();
  expect(source.updateSection).toHaveBeenCalledWith(ids.section, { capacity: 2 });
  expect(screen.getByLabelText(/^New capacity/)).toHaveAttribute("aria-invalid", "true");
});

it("AC-ENRL-005.7: a Chair approves a substitute course for named students", async () => {
  const { source, user } = open("chairperson");
  await user.click(await screen.findByRole("tab", { name: "Substitutions" }));
  await user.selectOptions(await screen.findByLabelText(/^Original course/), ids.cs101);
  await user.selectOptions(screen.getByLabelText(/^Substitute course/), ids.cs102);
  await user.type(screen.getByLabelText(/^Student IDs/), ids.student);
  await user.click(screen.getByRole("button", { name: "Approve substitution" }));
  await waitFor(() =>
    expect(source.approveSubstitution).toHaveBeenCalledWith({
      originalCourseId: ids.cs101,
      substituteCourseId: ids.cs102,
      studentIds: [ids.student],
    }),
  );
  expect(
    await screen.findByText(/CS102 now counts for CS101 in their degree progress only/),
  ).toBeInTheDocument();
});

it("shows loading, empty, and error with retry states", async () => {
  const source = fakeSource();
  let finish!: (value: CatalogCoursePage) => void;
  vi.mocked(source.listCourses)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockRejectedValueOnce(new ApiError(503, "SERVICE_UNAVAILABLE", { requestId: "req-9" }))
    .mockResolvedValue(page([]));
  const { user } = open("registrar", source);
  expect(await screen.findByText("Loading courses…")).toBeInTheDocument();
  finish(page([]));
  expect(await screen.findByText("No courses in your scope yet.")).toBeInTheDocument();
  await user.type(screen.getByLabelText("Search courses by code or title"), "zzz");
  await user.click(screen.getByRole("button", { name: "Search" }));
  expect(await screen.findByText("Reference: req-9")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Retry courses" }));
  expect(await screen.findByText("No courses match this search.")).toBeInTheDocument();
});

it("moves between tabs with the arrow keys", async () => {
  const { user } = open("dean");
  const courses = await screen.findByRole("tab", { name: "Courses" });
  courses.focus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Curricula" })).toHaveFocus();
  expect(screen.getByRole("tab", { name: "Curricula" })).toHaveAttribute("aria-selected", "true");
  await user.keyboard("{End}");
  expect(screen.getByRole("tab", { name: "Substitutions" })).toHaveFocus();
  await user.keyboard("{Home}");
  expect(screen.getByRole("tab", { name: "Courses" })).toHaveFocus();
});

it.each(["chairperson", "dean", "registrar"])("has no axe violations for %s", async (role) => {
  const { user } = open(role);
  await screen.findByRole("rowheader", { name: "CS101" });
  if (role === "chairperson") {
    await user.click(screen.getByRole("button", { name: "New course" }));
    await screen.findByLabelText("CS101: Programming 1", {}, { timeout: 3000 }).catch(() => null);
  }
  const results = await axe.run(document.body, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(results.violations).toEqual([]);
});

it.each([
  ["chairperson", true],
  ["dean", true],
  ["registrar", true],
  ["finance", false],
] as const)(
  "AC-ENRL-005.8: the Courses nav item for %s links to the catalog",
  async (role, shown) => {
    const { user } = open(role);
    await screen.findByRole("heading", { level: 1 });
    const sidebar = screen.getAllByRole("navigation", { name: "Admin modules" })[0]!;
    const academics = within(sidebar).getByRole("button", { name: /Academics/ });
    if (academics.getAttribute("aria-expanded") !== "true") await user.click(academics);
    if (shown) {
      expect(await within(sidebar).findByRole("link", { name: "Courses" })).toHaveAttribute(
        "href",
        "/catalog",
      );
    } else {
      await within(sidebar).findByText("Calendar");
      expect(within(sidebar).queryByText("Courses")).not.toBeInTheDocument();
    }
  },
);
