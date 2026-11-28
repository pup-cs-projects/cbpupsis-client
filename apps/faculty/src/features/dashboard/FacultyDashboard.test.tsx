import { cleanup, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { session } from "../../lib/auth";
import { renderFaculty, sectionWire, rosterWire } from "../../test/renderFaculty";

const sheet = {
  sectionId: "section-1",
  sectionName: "BSCS 2-1",
  courseCode: "COMP 001",
  courseTitle: "Introduction to Computing",
  state: "DRAFT",
  version: 1,
  deadline: "2027-01-15T12:00:00Z",
  deadlinePassed: false,
  submittedAt: null,
  grades: [
    {
      studentId: "student-1",
      studentNumber: "S-1",
      studentName: "Ana",
      finalGrade: null,
      completionDeadline: null,
    },
  ],
};
const sections = { items: [sectionWire], total: 1, limit: 20, offset: 0 };
const notifications = {
  items: [
    {
      id: "n1",
      notification_type: "roster.updated",
      title: "Class roster updated",
      body: "A student joined your section.",
      created_at: "2026-11-19T01:00:00Z",
      read_at: null,
    },
  ],
  total: 1,
  limit: 5,
  offset: 0,
};
const defaults = {
  "GET /faculty/sections": { status: 200, body: sections },
  "GET /faculty/sections/section-1/grades": { status: 200, body: sheet },
  "GET /notifications": { status: 200, body: notifications },
};
beforeEach(() => vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null));
afterEach(async () => {
  cleanup();
  await session.signOut();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function metric(name: string) {
  return within(
    screen
      .getAllByRole("heading", { name })
      .map((heading) => heading.closest("article"))
      .find((article) => article !== null)!,
  );
}
async function open(routes: Parameters<typeof renderFaculty>[1] = {}) {
  const view = renderFaculty("/dashboard", { ...defaults, ...routes });
  await screen.findByRole("heading", { name: "Students taught" });
  return { ...view, user: userEvent.setup() };
}
it("loads the signed-in faculty name, real section metrics, deadlines, and notifications", async () => {
  const { calls } = await open();
  expect(screen.getByRole("heading", { name: "Welcome, Prof. Maria Santos" })).toBeInTheDocument();
  expect(metric("Students taught").getByText("1")).toBeInTheDocument();
  expect(metric("Sections awaiting grades").getByText("1")).toBeInTheDocument();
  expect(screen.getByText("Class roster updated")).toBeInTheDocument();
  expect(screen.getByText("Submission open")).toBeInTheDocument();
  expect(screen.queryByText("Juan A. Dela Cruz")).not.toBeInTheDocument();
  expect(
    calls
      .filter((call) => call.route.startsWith("GET /faculty/"))
      .every((call) => call.authorization === "Bearer access-1"),
  ).toBe(true);
});
it("links the dashboard to the section roster, grade entry, profile, and INC pages", async () => {
  const { user } = await open({
    "GET /faculty/sections/section-1/roster": { status: 200, body: rosterWire },
  });
  expect(
    screen.getAllByRole("link", { name: "Enter grades for COMP 001, BSCS 2-1" })[0],
  ).toHaveAttribute("href", "/sections/section-1/grades");
  if (screen.queryByRole("button", { name: /Account menu/ })) {
    await user.click(screen.getByRole("button", { name: /Account menu/ }));
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("button", { name: /Open notifications/ })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  }
  await user.click(screen.getAllByRole("link", { name: "Open roster for COMP 001, BSCS 2-1" })[0]!);
  await screen.findByRole("heading", { name: "Class roster · COMP 001 · BSCS 2-1" });
  if (screen.queryByRole("button", { name: "Expand menu" }))
    await user.click(screen.getByRole("button", { name: "Expand menu" }));
  await user.click(screen.getByRole("button", { name: "Grades" }));
  expect(screen.getByRole("link", { name: "Incomplete grades" })).toHaveAttribute(
    "href",
    "/incompletes",
  );
});
it("shows real zeroes and empty states when no sections or notifications exist", async () => {
  await open({
    "GET /faculty/sections": { status: 200, body: { ...sections, items: [], total: 0 } },
    "GET /notifications": { status: 200, body: { ...notifications, items: [], total: 0 } },
  });
  expect(metric("Students taught").getByText("0")).toBeInTheDocument();
  expect(metric("Assigned sections").getByText("0")).toBeInTheDocument();
  expect(screen.getByText("No sections are assigned to you yet.")).toBeInTheDocument();
  expect(screen.getByText("No notifications yet.")).toBeInTheDocument();
});
it("keeps partial failures explicit rather than showing invented counts or an empty notification feed", async () => {
  await open({
    "GET /faculty/sections/section-1/grades": { status: 503 },
    "GET /notifications": { status: 503 },
  });
  expect(metric("Students taught").getByText("Unavailable")).toBeInTheDocument();
  expect(metric("Sections awaiting grades").getByText("Unavailable")).toBeInTheDocument();
  expect(screen.getByText("Some dashboard information is unavailable.")).toBeInTheDocument();
  expect(screen.queryByText("No notifications yet.")).not.toBeInTheDocument();
});
it("retries a failed section read and refreshes finalization status from the backend", async () => {
  const { user } = await open({
    "GET /faculty/sections/section-1/grades": [
      { status: 503 },
      { status: 200, body: { ...sheet, state: "FINAL" } },
    ],
  });
  expect(metric("Sections awaiting grades").getByText("Unavailable")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Refresh dashboard" }));
  await waitFor(() =>
    expect(metric("Sections awaiting grades").getByText("0")).toBeInTheDocument(),
  );
  expect(screen.getAllByRole("link", { name: "View grades for COMP 001, BSCS 2-1" })).toHaveLength(
    2,
  );
  expect(screen.getByText("No grade submissions are pending.")).toBeInTheDocument();
});
it("shows a retry when the assignments endpoint fails instead of presenting a fictional dashboard", async () => {
  const { called } = renderFaculty("/dashboard", {
    ...defaults,
    "GET /faculty/sections": [{ status: 503 }, { status: 200, body: sections }],
  });
  await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
  await screen.findByRole("heading", { name: "Students taught" });
  expect(called("GET /faculty/sections")).toHaveLength(2);
});
it("shows a loading status while assigned sections load", async () => {
  renderFaculty("/dashboard", { ...defaults, "GET /faculty/sections": "pending" });
  expect(await screen.findByText("Loading faculty dashboard")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Students taught" })).not.toBeInTheDocument();
});
it("has no axe violations with live-contract fixture data", async () => {
  const { container } = await open();
  expect((await axe.run(container)).violations).toEqual([]);
});
