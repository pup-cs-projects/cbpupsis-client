import { cleanup, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { session } from "../../lib/auth";
import { renderFaculty, sectionWire } from "../../test/renderFaculty";
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
