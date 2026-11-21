import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { session } from "../../lib/auth";
import { me } from "../../test/fixtures";
import { renderFaculty, sectionWire } from "../../test/renderFaculty";

const sheet = {
  sectionId: "section-1",
  sectionName: "BSCS 2-1",
  courseCode: "COMP 001",
  courseTitle: "Introduction to Computing",
  state: "DRAFT",
  version: 1,
  submittedAt: null,
  grades: [],
};
const routes = {
  "GET /faculty/sections": {
    status: 200,
    body: { items: [sectionWire], total: 1, limit: 20, offset: 0 },
  },
  "GET /faculty/sections/section-1/grades": { status: 200, body: sheet },
};
afterEach(async () => {
  cleanup();
  await session.signOut();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(["/sections", "/grades"])(
  "%s shows the real course code/title and keeps the section visible",
  async (path) => {
    const view = renderFaculty(path, routes);
    const title = await screen.findByRole("heading", {
      name: "COMP 001 · Introduction to Computing",
    });
    const card = within(title.closest("article")!);
    expect(card.getByText("Section: BSCS 2-1")).toBeInTheDocument();
    expect(card.getByRole("link", { name: /Enter grades/ })).toHaveAttribute(
      "href",
      "/sections/section-1/grades",
    );
    expect(view.called("GET /faculty/sections/section-1/grades")).toHaveLength(1);
    expect(
      view.client.getQueryData(["faculty-section-course", me.id, "section-1"]),
    ).not.toHaveProperty("rows");
  },
);
it("keeps the roster available when course lookup fails and retries only that course", async () => {
  const view = renderFaculty("/sections", {
    ...routes,
    "GET /faculty/sections/section-1/grades": [{ status: 503 }, { status: 200, body: sheet }],
  });
  await screen.findByText("Course information could not be loaded.");
  expect(screen.getByRole("link", { name: "Open roster for BSCS 2-1" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Retry course information" }));
  await screen.findByRole("heading", { name: "COMP 001 · Introduction to Computing" });
  expect(view.called("GET /faculty/sections")).toHaveLength(1);
  expect(view.called("GET /faculty/sections/section-1/grades")).toHaveLength(2);
});
it("reuses course labels when navigating from Assigned sections to Grades", async () => {
  const view = renderFaculty("/sections", routes);
  await screen.findByRole("heading", { name: "COMP 001 · Introduction to Computing" });
  await view.router.navigate({ to: "/grades" });
  await screen.findByRole("heading", { name: "COMP 001 · Introduction to Computing" });
  expect(view.called("GET /faculty/sections/section-1/grades")).toHaveLength(1);
});
