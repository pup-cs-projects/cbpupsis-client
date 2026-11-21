import { cleanup, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { session } from "../../lib/auth";
import { me } from "../../test/fixtures";
import { renderFaculty, sectionWire } from "../../test/renderFaculty";
import { rememberCourseLabel } from "./courseLabels";
afterEach(async () => {
  cleanup();
  await session.signOut();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("AC-FAC-004.1: assigned sections show capacity, status and roster navigation", async () => {
  renderFaculty("/sections", {
    "GET /faculty/sections": {
      status: 200,
      body: { items: [sectionWire], total: 1, limit: 20, offset: 0 },
    },
  });
  await screen.findByRole("heading", { name: "BSCS 2-1" });
  expect(screen.getByText("Capacity: 40")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open roster for BSCS 2-1" })).toHaveAttribute(
    "href",
    "/sections/section-1/roster",
  );
});
it("AC-FAC-004.1: reuses course labels already loaded by the dashboard and names each section's links", async () => {
  const twin = { ...sectionWire, id: "section-2" };
  const view = renderFaculty("/sections", {
    "GET /faculty/sections": {
      status: 200,
      body: { items: [sectionWire, twin], total: 2, limit: 20, offset: 0 },
    },
  });
  rememberCourseLabel(view.client, me.id, "section-1", "COMP 001", "Introduction to Computing");
  rememberCourseLabel(
    view.client,
    me.id,
    "section-2",
    "MATH 101",
    "Mathematics in the Modern World",
  );
  await screen.findByRole("heading", { name: "COMP 001 · Introduction to Computing" });
  expect(
    screen.getByRole("heading", { name: "MATH 101 · Mathematics in the Modern World" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open roster for COMP 001, BSCS 2-1" })).toHaveAttribute(
    "href",
    "/sections/section-1/roster",
  );
  expect(screen.getByRole("link", { name: "Enter grades for MATH 101, BSCS 2-1" })).toHaveAttribute(
    "href",
    "/sections/section-2/grades",
  );
  expect(view.calls.filter((call) => call.route.endsWith("/grades"))).toHaveLength(0);
});
