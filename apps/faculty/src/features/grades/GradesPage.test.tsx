import { ApiError } from "@cbpupsis/shared/api";
import { GradeValidationError, type FacultyGradeSheet } from "@cbpupsis/shared/grades";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { session } from "../../lib/auth";
import { createGradingFixtureSource, gradingSheet } from "../../test/gradingFixtures";
import { installGradingDialogDom, renderGrading } from "../../test/renderGrading";
import { GradesPage } from "./GradesPage";

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
async function openPage(source = createGradingFixtureSource()) {
  const view = renderGrading(<GradesPage sectionId="section-1" dataSource={source} />);
  await screen.findByRole("combobox", { name: /Grade for Ana Santos/ });
  return { ...view, source, user: userEvent.setup() };
}

describe("Faculty grade grid (US-FAC-001)", () => {
  it("AC-FAC-001.1: saves normalized marks with the loaded version and shows the API save time", async () => {
    const source = createGradingFixtureSource();
    const save = vi.spyOn(source, "saveDraft");
    const { user } = await openPage(source);
    await user.type(screen.getByRole("combobox", { name: /Grade for Luis Reyes/ }), "2");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText(/Draft saved at/);
    expect(save).toHaveBeenCalledWith(
      "section-1",
      expect.objectContaining({
        version: 1,
        grades: expect.arrayContaining([{ studentId: "student-2", mark: "2.00" }]),
      }),
    );
    expect(screen.getByRole("combobox", { name: /Grade for Luis Reyes/ })).toHaveValue("2.00");
  });
  it("AC-FAC-001.1: the 60-second autosave callback uses the latest edits", async () => {
    const interval = vi.spyOn(window, "setInterval");
    const source = createGradingFixtureSource();
    const save = vi.spyOn(source, "saveDraft");
    const { user } = await openPage(source);
    await user.type(screen.getByRole("combobox", { name: /Grade for Luis Reyes/ }), "1.75");
    const callback = interval.mock.calls.find(([, delay]) => delay === 60_000)?.[0];
    expect(typeof callback).toBe("function");
    await act(async () => {
      if (typeof callback === "function") callback();
    });
    expect(save).toHaveBeenCalledWith(
      "section-1",
      expect.objectContaining({
        grades: expect.arrayContaining([{ studentId: "student-2", mark: "1.75" }]),
      }),
    );
  });
  it("AC-FAC-001.1: edits made during a draft save survive and use the returned version next time", async () => {
    const source = createGradingFixtureSource();
    let finish!: (value: FacultyGradeSheet) => void;
    const save = vi.spyOn(source, "saveDraft").mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { user } = await openPage(source);
    const field = screen.getByRole("combobox", { name: /Grade for Luis Reyes/ });
    await user.type(field, "1.75");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await user.clear(field);
    await user.type(field, "2.00");
    await act(async () =>
      finish({
        ...gradingSheet,
        version: 2,
        rows: gradingSheet.rows.map((row) =>
          row.studentId === "student-2" ? { ...row, mark: "1.75" } : row,
        ),
      }),
    );
    expect(field).toHaveValue("2.00");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith("section-1", expect.objectContaining({ version: 2 })),
    );
  });
  it("AC-FAC-001.2: confirms finalization, saves dirty marks first and locks only after success", async () => {
    const source = createGradingFixtureSource();
    const finalize = vi.spyOn(source, "finalize");
    const { user } = await openPage(source);
    await user.type(screen.getByRole("combobox", { name: /Grade for Luis Reyes/ }), "2.00");
    await user.click(screen.getByRole("button", { name: "Submit final grades" }));
    expect(finalize).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent(/cannot be edited here afterward/);
    await user.click(screen.getByRole("button", { name: "Confirm final submission" }));
    await screen.findByText(/Grades submitted successfully/);
    expect(finalize).toHaveBeenCalledWith("section-1", 2);
    expect(screen.getByRole("combobox", { name: /Grade for Ana Santos/ })).toHaveAttribute(
      "readonly",
    );
    expect(screen.getByRole("button", { name: "Submit final grades" })).toBeDisabled();
  });
  it("AC-FAC-001.3: shows the Inc deadline supplied by the API without computing one", async () => {
    await openPage();
    expect(screen.getByRole("combobox", { name: /Grade for Carlo Cruz/ })).toHaveValue("INC");
    expect(screen.getByText(/2027/, { selector: "td" })).toBeInTheDocument();
  });
  it("AC-FAC-001.9: disables finalize after the deadline while keeping drafts editable", async () => {
    const source = createGradingFixtureSource();
    vi.spyOn(source, "deadline").mockResolvedValue({
      deadline: "2026-01-01T00:00:00Z",
      passed: true,
    });
    await openPage(source);
    expect(screen.getByRole("button", { name: "Submit final grades" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The deadline has passed. Ask an administrator for an override.",
    );
    expect(screen.getByRole("combobox", { name: /Grade for Ana Santos/ })).not.toHaveAttribute(
      "readonly",
    );
  });
  it("AC-FAC-001.10: a section ownership 404 uses the standard not-found page with no grade details", async () => {
    const source = createGradingFixtureSource();
    vi.spyOn(source, "sheet").mockRejectedValue(new ApiError(404, "RESOURCE_NOT_FOUND"));
    renderGrading(<GradesPage sectionId="section-1" dataSource={source} />);
    await screen.findByRole("heading", { name: /not found/i });
    expect(screen.queryByText("Ana Santos")).not.toBeInTheDocument();
  });
  it("labels and announces local and backend cell errors without finalizing invalid grades", async () => {
    const source = createGradingFixtureSource();
    const save = vi.spyOn(source, "saveDraft");
    const finalize = vi.spyOn(source, "finalize");
    const { user } = await openPage(source);
    const field = screen.getByRole("combobox", { name: /Grade for Luis Reyes/ });
    await user.type(field, "6");
    await user.click(screen.getByRole("button", { name: "Submit final grades" }));
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(save).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
    await user.clear(field);
    await user.type(field, "2.00");
    save.mockRejectedValueOnce(
      new GradeValidationError({ "student-2": "This mark must be corrected." }),
    );
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("This mark must be corrected.");
    expect(field).toHaveAttribute("aria-invalid", "true");
  });
  it.each(["VERSION_CONFLICT", "GRADES_LOCKED"])(
    "handles %s without replaying a write",
    async (code) => {
      const source = createGradingFixtureSource();
      const save = vi.spyOn(source, "saveDraft").mockRejectedValueOnce(new ApiError(409, code));
      const { user } = await openPage(source);
      await user.type(screen.getByRole("combobox", { name: /Grade for Luis Reyes/ }), "2.00");
      await user.click(screen.getByRole("button", { name: "Save draft" }));
      await screen.findByText(
        code === "VERSION_CONFLICT"
          ? "These grades changed in another window. Reload to continue."
          : "These grades are final. Use Correction of Entry to change one.",
        { selector: "p" },
      );
      expect(save).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    },
  );
  it("asks before leaving unsaved grades and keeps the draft when cancelled", async () => {
    const { user } = await openPage();
    const field = screen.getByRole("combobox", { name: /Grade for Luis Reyes/ });
    await user.type(field, "2.00");
    await user.click(screen.getByRole("link", { name: "Grades" }));
    await screen.findByRole("dialog", { name: "Leave unsaved grades?" });
    await user.click(screen.getByRole("button", { name: "Keep editing grades" }));
    expect(field).toHaveValue("2.00");
  });
  it.each(["recheck", "refusal"])(
    "AC-FAC-001.9: a deadline %s during finalization keeps grades editable and unfinalized",
    async (mode) => {
      const source = createGradingFixtureSource();
      const deadline = vi.spyOn(source, "deadline");
      if (mode === "recheck")
        deadline
          .mockResolvedValueOnce({ deadline: null, passed: false })
          .mockResolvedValue({ deadline: null, passed: true });
      const finalize = vi.spyOn(source, "finalize");
      if (mode === "refusal")
        finalize.mockRejectedValueOnce(new ApiError(403, "GRADE_DEADLINE_PASSED"));
      const { user } = await openPage(source);
      await user.type(screen.getByRole("combobox", { name: /Grade for Luis Reyes/ }), "2.00");
      await user.click(screen.getByRole("button", { name: "Submit final grades" }));
      await user.click(screen.getByRole("button", { name: "Confirm final submission" }));
      await screen.findByText("The deadline has passed. Ask an administrator for an override.");
      expect(finalize).toHaveBeenCalledTimes(mode === "recheck" ? 0 : 1);
      expect(screen.getByRole("button", { name: "Submit final grades" })).toBeDisabled();
      expect(screen.getByRole("combobox", { name: /Grade for Ana Santos/ })).not.toHaveAttribute(
        "readonly",
      );
    },
  );
  it("reloads a conflicted draft only after confirmation and uses the fresh version", async () => {
    const source = createGradingFixtureSource();
    const save = vi
      .spyOn(source, "saveDraft")
      .mockRejectedValueOnce(new ApiError(409, "VERSION_CONFLICT"));
    const read = vi.spyOn(source, "sheet");
    const { user } = await openPage(source);
    await user.type(screen.getByRole("combobox", { name: /Grade for Luis Reyes/ }), "2.00");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByRole("button", { name: "Reload grades" });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    read.mockResolvedValueOnce({ ...gradingSheet, version: 5 });
    await user.click(screen.getByRole("button", { name: "Reload grades" }));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /Grade for Luis Reyes/ })).toHaveValue(""),
    );
    await user.type(screen.getByRole("combobox", { name: /Grade for Luis Reyes/ }), "1.75");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() =>
      expect(save).toHaveBeenLastCalledWith("section-1", expect.objectContaining({ version: 5 })),
    );
  });
  it("has no axe violations and keeps all mark cells keyboard reachable", async () => {
    const { container } = await openPage();
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations).toEqual([]);
    expect(screen.getByRole("combobox", { name: /Grade for Ana Santos/ })).not.toHaveAttribute(
      "tabindex",
      "-1",
    );
  });
});
