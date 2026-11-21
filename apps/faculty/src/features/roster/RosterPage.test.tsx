import { ApiError } from "@cbpupsis/shared/api";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { facultySectionsApi, session } from "../../lib/auth";
import { installGradingDialogDom } from "../../test/renderGrading";
import { renderFaculty, rosterWire, sectionWire } from "../../test/renderFaculty";

let restore: () => void;
beforeEach(() => {
  restore = installGradingDialogDom();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(async () => {
  cleanup();
  restore();
  await session.signOut();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function open(body = rosterWire) {
  return renderFaculty("/sections/section-1/roster", {
    "GET /faculty/sections/section-1/roster": { status: 200, body },
  });
}
it("AC-FAC-004.1/.4: renders enrollment, grade and add/drop status as text", async () => {
  open();
  await screen.findByRole("heading", { name: /Class roster · BSCS 2-1/ });
  expect(screen.getAllByText("2026-00001-MN-0")).toHaveLength(2);
  expect(screen.getAllByText("Pending add")).toHaveLength(2);
  expect(screen.getAllByText("ana@example.com")).toHaveLength(2);
});
it("AC-FAC-004.2/.3: filters reset paging, announce counts and can be cleared", async () => {
  const api = vi.spyOn(facultySectionsApi, "roster");
  open({ ...rosterWire, total: 21 });
  await screen.findByText("Showing 1 to 1 of 21 students");
  const user = userEvent.setup();
  api.mockResolvedValueOnce({
    ...sectionWire,
    sectionName: sectionWire.section_name,
    roster: [],
    total: 21,
    limit: 20,
    offset: 20,
  });
  await user.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(api).toHaveBeenLastCalledWith("access-1", "section-1", {}, 20, expect.any(AbortSignal)),
  );
  await user.selectOptions(screen.getByLabelText("Enrollment status"), "DROPPED");
  await waitFor(() =>
    expect(api).toHaveBeenLastCalledWith(
      "access-1",
      "section-1",
      { enrollmentStatus: "DROPPED" },
      0,
      expect.any(AbortSignal),
    ),
  );
  await user.selectOptions(screen.getByLabelText("Grade status"), "INC");
  await waitFor(() =>
    expect(api).toHaveBeenLastCalledWith(
      "access-1",
      "section-1",
      { enrollmentStatus: "DROPPED", gradeStatus: "INC" },
      0,
      expect.any(AbortSignal),
    ),
  );
  await user.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getByLabelText("Grade status")).toHaveValue("");
});
it("AC-FAC-004.3: disables Next on the last page", async () => {
  open();
  await screen.findByText("Showing 1 to 1 of 1 students");
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
});
it("AC-FAC-004.5: exports active filters, reports failure and allows retry", async () => {
  const exportCsv = vi
    .spyOn(facultySectionsApi, "exportCsv")
    .mockRejectedValueOnce(new ApiError(503, "SERVICE_UNAVAILABLE"));
  open();
  await screen.findByText("Showing 1 to 1 of 1 students");
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText("Grade status"), "INC");
  await user.click(screen.getByRole("button", { name: "Export CSV" }));
  await screen.findByText(/Export failed/);
  expect(exportCsv).toHaveBeenCalledWith("access-1", "section-1", { gradeStatus: "INC" });
  const create = vi.fn(() => "blob:roster");
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  exportCsv.mockResolvedValue(new Blob(["name\nAna"]));
  await user.click(screen.getByRole("button", { name: "Retry CSV export" }));
  await waitFor(() => expect(create).toHaveBeenCalled());
  expect(screen.queryByText(/Export failed/)).not.toBeInTheDocument();
});
it("AC-FAC-004.6: shows only the teaching details returned by the API", async () => {
  renderFaculty("/sections/section-1/roster", {
    "GET /faculty/sections/section-1/roster": { status: 200, body: rosterWire },
    "GET /faculty/sections/section-1/roster/student-1": {
      status: 200,
      body: {
        name: "Ana Santos",
        studentNumber: "2026-00001-MN-0",
        email: "ana@example.com",
        program: "BS Computer Science",
        yearLevel: 2,
        privateAddress: "MUST NOT DISPLAY",
      },
    },
  });
  await screen.findByText("Showing 1 to 1 of 1 students");
  await userEvent.click(
    screen.getAllByRole("button", { name: "View teaching details for Ana Santos" })[0]!,
  );
  await screen.findByText("BS Computer Science");
  expect(screen.queryByText("MUST NOT DISPLAY")).not.toBeInTheDocument();
  expect(screen.getByRole("dialog")).not.toHaveTextContent(/birthdate|emergency contact/i);
});
it("AC-FAC-004.7: ownership 404 shows the standard not-found screen with no details", async () => {
  renderFaculty("/sections/foreign/roster", {
    "GET /faculty/sections/foreign/roster": { status: 404, body: { code: "RESOURCE_NOT_FOUND" } },
  });
  await screen.findByRole("heading", { name: /not found/i });
  expect(screen.queryByText("BSCS 2-1")).not.toBeInTheDocument();
});
it("AC-FAC-004.9: distinguishes an empty section from empty filtered results", async () => {
  open({ ...rosterWire, roster: [], total: 0 });
  await screen.findByText("No students are enrolled yet");
  await userEvent.selectOptions(screen.getByLabelText("Grade status"), "INC");
  await screen.findByText("No students match these filters");
});
it("AC-FAC-004.1: the roster has no axe violations", async () => {
  const { container } = open();
  await screen.findByText("Showing 1 to 1 of 1 students");
  expect((await axe.run(container)).violations).toEqual([]);
});
