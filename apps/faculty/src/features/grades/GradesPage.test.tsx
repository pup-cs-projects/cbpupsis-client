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
import type { FacultyGradeSheet as ModeGradeSheet, GradingMode } from "./gradingMode";
import { renderFaculty } from "../../test/renderFaculty";

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
  vi.unstubAllEnvs();
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
    await user.click(screen.getByRole("link", { name: "Grades" }));
    await screen.findByRole("dialog", { name: "Leave unsaved grades?" });
    await user.click(screen.getByRole("button", { name: "Keep editing grades" }));
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
    expect(screen.getByText(/Saved: .*2027/)).toBeInTheDocument();
    expect(
      screen.getByLabelText("INC completion deadline for Carlo Cruz").getAttribute("value"),
    ).toMatch(/^2027-/);
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
  it("shows the authoritative final marks after GRADES_LOCKED instead of retaining unsaved edits", async () => {
    const source = createGradingFixtureSource();
    const { user } = await openPage(source);
    vi.spyOn(source, "sheet").mockResolvedValueOnce({
      ...gradingSheet,
      state: "FINAL",
      version: 9,
      rows: gradingSheet.rows.map((row) => ({ ...row, mark: "1.50" })),
    });
    vi.spyOn(source, "saveDraft").mockRejectedValueOnce(new ApiError(409, "GRADES_LOCKED"));
    const field = screen.getByRole("combobox", { name: /Grade for Luis Reyes/ });
    await user.type(field, "2.00");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(field).toHaveValue("1.50"));
    expect(field).toHaveAttribute("readonly");
  });
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

function modeSheet(mode: GradingMode): ModeGradeSheet {
  return {
    ...structuredClone(gradingSheet),
    gradingMode: mode,
    allowedMarks: mode === "PASS_FAIL" ? ["PASS", "FAIL"] : ["1.00", "1.50", "2.00", "5.00", "INC"],
    rows: gradingSheet.rows.map((row, index) => ({
      ...row,
      completionDeadline: null,
      mark: index === 1 ? null : mode === "PASS_FAIL" ? (index === 0 ? "PASS" : "FAIL") : "1.50",
    })),
  };
}
function modeSource(mode: GradingMode, complete = false) {
  let sheet = modeSheet(mode);
  if (complete) sheet.rows[1]!.mark = mode === "PASS_FAIL" ? "PASS" : "2.00";
  return {
    ...createGradingFixtureSource(),
    sheet: vi.fn(async () => structuredClone(sheet)),
    saveDraft: vi.fn(
      async (
        _id: string,
        input: { version: number; grades: { studentId: string; mark: string | null }[] },
      ) => {
        sheet = {
          ...sheet,
          version: input.version + 1,
          savedAt: "2026-11-12T01:00:00Z",
          rows: sheet.rows.map((row) => ({
            ...row,
            mark: input.grades.find((grade) => grade.studentId === row.studentId)?.mark ?? null,
          })),
        };
        return structuredClone(sheet);
      },
    ),
    finalize: vi.fn(async (_id: string, version: number) => ({
      state: "FINAL" as const,
      version: version + 1,
      finalizedAt: "2026-11-12T01:05:00Z",
      recordsCommitted: 3,
      notificationsQueued: 3,
    })),
  };
}

describe("Pass/Fail grading (US-FAC-003)", () => {
  it("AC-FAC-003.1/.6: the default live adapter loads, saves and finalizes the published Pass/Fail contract", async () => {
    vi.stubEnv("VITE_FEATURE_MOCKS", "true");
    const wire = {
      sectionId: "section-1",
      sectionName: "BSCS 2-1",
      courseCode: "NSTP 002",
      courseTitle: "Civic Welfare Training",
      gradingMode: "PASS_FAIL",
      allowedMarks: ["PASS", "FAIL"],
      state: "DRAFT",
      version: 1,
      submittedAt: null,
      grades: [
        {
          studentId: "student-1",
          studentNumber: "S-1",
          studentName: "Ana Santos",
          finalGrade: null,
          completionDeadline: null,
        },
      ],
    };
    const saved = { ...wire, version: 2, grades: [{ ...wire.grades[0], finalGrade: "PASS" }] };
    const { called } = renderFaculty("/sections/section-1/grades", {
      "GET /faculty/sections/section-1/grades": { status: 200, body: wire },
      "GET /faculty/sections/section-1/grade-deadline": {
        status: 200,
        body: { deadline: "2027-01-01T00:00:00Z", passed: false },
      },
      "PUT /faculty/sections/section-1/grades/draft": { status: 200, body: saved },
      "POST /faculty/sections/section-1/grades/finalize": {
        status: 200,
        body: {
          state: "FINAL",
          version: 3,
          submittedAt: "2026-11-19T01:00:00Z",
          recordsCommitted: 1,
          notificationsQueued: 1,
        },
      },
    });
    const user = userEvent.setup();
    const field = await screen.findByRole("combobox", { name: /Grade for Ana/ });
    expect(field.tagName).toBe("SELECT");
    expect(screen.getByText(/This section is graded Pass or Fail/)).toBeInTheDocument();
    await user.selectOptions(field, "PASS");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText(/Draft saved at/);
    expect(called("PUT /faculty/sections/section-1/grades/draft")[0]?.body).toEqual({
      version: 1,
      grades: [{ studentId: "student-1", finalGrade: "PASS" }],
    });
    await user.click(screen.getByRole("button", { name: "Submit final grades" }));
    await user.click(screen.getByRole("button", { name: "Confirm final submission" }));
    await screen.findByText(/Grades submitted successfully/);
    expect(called("POST /faculty/sections/section-1/grades/finalize")[0]?.body).toEqual({
      version: 2,
    });
    expect(field).toBeDisabled();
  });

  it.each(["NUMERIC", "PASS_FAIL"] as const)(
    "AC-FAC-003.2/.3: a live %s mismatch reloads server choices without replaying the write",
    async (mode) => {
      const initialMarks =
        mode === "PASS_FAIL" ? ["PASS", "FAIL"] : ["1.00", "2.00", "5.00", "INC"];
      const nextMode = mode === "PASS_FAIL" ? "NUMERIC" : "PASS_FAIL";
      const nextMarks =
        nextMode === "PASS_FAIL" ? ["PASS", "FAIL"] : ["1.00", "2.00", "5.00", "INC"];
      const wire = {
        sectionId: "section-1",
        sectionName: "BSCS 2-1",
        gradingMode: mode,
        allowedMarks: initialMarks,
        state: "DRAFT",
        version: 1,
        submittedAt: null,
        grades: [
          {
            studentId: "student-1",
            studentNumber: "S-1",
            studentName: "Ana Santos",
            finalGrade: null,
            completionDeadline: null,
          },
        ],
      };
      const { called } = renderFaculty("/sections/section-1/grades", {
        "GET /faculty/sections/section-1/grades": [
          { status: 200, body: wire },
          { status: 200, body: { ...wire, gradingMode: nextMode, allowedMarks: nextMarks } },
        ],
        "GET /faculty/sections/section-1/grade-deadline": {
          status: 200,
          body: { deadline: "2027-01-01T00:00:00Z", passed: false },
        },
        "PUT /faculty/sections/section-1/grades/draft": {
          status: 422,
          body: { code: "GRADE_MODE_MISMATCH", gradingMode: nextMode, allowedMarks: nextMarks },
        },
      });
      const user = userEvent.setup();
      const field = await screen.findByRole("combobox", { name: /Grade for Ana/ });
      if (mode === "PASS_FAIL") await user.selectOptions(field, "PASS");
      else await user.type(field, "2.00");
      await user.click(screen.getByRole("button", { name: "Save draft" }));
      await screen.findByText(/The latest allowed marks have been loaded/);
      expect(screen.getByRole("combobox", { name: /Grade for Ana/ }).tagName).toBe(
        nextMode === "PASS_FAIL" ? "SELECT" : "INPUT",
      );
      expect(called("GET /faculty/sections/section-1/grades")).toHaveLength(2);
      expect(called("PUT /faculty/sections/section-1/grades/draft")).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    },
  );
  it("AC-FAC-003.1: offers only Pass and Fail, names the mode, labels each student, and supports keyboard focus", async () => {
    const { user } = await openPage(modeSource("PASS_FAIL"));
    expect(screen.getByText(/This section is graded Pass or Fail/)).toBeInTheDocument();
    const fields = screen.getAllByRole("combobox", { name: /^Grade for/ });
    expect(fields).toHaveLength(3);
    for (const field of fields) {
      expect(field.tagName).toBe("SELECT");
      expect(Array.from((field as HTMLSelectElement).options).map((option) => option.text)).toEqual(
        ["Select mark", "Pass", "Fail"],
      );
    }
    expect(document.querySelector('input[list="grade-values"]')).toBeNull();
    expect(
      screen.queryByRole("columnheader", { name: "Inc completion deadline" }),
    ).not.toBeInTheDocument();
    fields[0]!.focus();
    await user.tab();
    expect(fields[1]).toHaveFocus();
    await user.selectOptions(fields[1]!, "FAIL");
    expect(fields[1]).toHaveValue("FAIL");
    expect(screen.getByText("3 of 3 students marked")).toBeInTheDocument();
  });
  it("AC-FAC-003.1 boundary: honors a narrower allowedMarks list rather than inventing choices", async () => {
    const source = modeSource("PASS_FAIL");
    source.sheet.mockResolvedValueOnce({ ...modeSheet("PASS_FAIL"), allowedMarks: ["PASS"] });
    await openPage(source);
    const options = (screen.getByRole("combobox", { name: /Grade for Luis/ }) as HTMLSelectElement)
      .options;
    expect(Array.from(options).map((option) => option.value)).toEqual(["", "PASS"]);
  });
  it("AC-FAC-003.3: numeric sections keep numeric entry and refuse Pass locally", async () => {
    const source = modeSource("NUMERIC");
    const { user } = await openPage(source);
    const field = screen.getByRole("combobox", { name: /Grade for Luis/ });
    expect(field.tagName).toBe("INPUT");
    expect(screen.getByText(/This section uses numeric grades/)).toBeInTheDocument();
    await user.type(field, "PASS");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(source.saveDraft).not.toHaveBeenCalled();
    await user.clear(field);
    await user.type(field, "2");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() =>
      expect(source.saveDraft).toHaveBeenCalledWith(
        "section-1",
        expect.objectContaining({
          grades: expect.arrayContaining([{ studentId: "student-2", mark: "2.00" }]),
        }),
      ),
    );
  });
  it("AC-FAC-003.3 boundary: numeric marks must also belong to the API allowedMarks list", async () => {
    const source = modeSource("NUMERIC");
    const { user } = await openPage(source);
    const field = screen.getByRole("combobox", { name: /Grade for Luis/ });
    await user.type(field, "1.25");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(source.saveDraft).not.toHaveBeenCalled();
  });
  it.each([
    { gradingMode: "PASS_FAIL" as const },
    { gradingMode: "PASS_FAIL" as const, allowedMarks: [] },
    { gradingMode: "PASS_FAIL" as const, allowedMarks: ["1.00"] },
    { allowedMarks: ["PASS", "FAIL"] },
  ])(
    "AC-FAC-003.1 negative: pauses edits for incomplete or incompatible mode metadata: %j",
    async (metadata) => {
      const source = modeSource("PASS_FAIL");
      source.sheet.mockResolvedValueOnce({
        ...gradingSheet,
        gradingMode: undefined,
        allowedMarks: undefined,
        ...metadata,
      });
      await openPage(source);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The grading mode or allowed marks could not be confirmed.",
      );
      expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Submit final grades" })).toBeDisabled();
      expect(source.saveDraft).not.toHaveBeenCalled();
    },
  );
  it.each(["NUMERIC", "PASS_FAIL"] as const)(
    "AC-FAC-003.2 / AC-FAC-003.3: a %s draft mode mismatch reloads choices and pauses autosave until review",
    async (initialMode) => {
      const source = modeSource(initialMode);
      const interval = vi.spyOn(window, "setInterval");
      const { user } = await openPage(source);
      const nextMode = initialMode === "NUMERIC" ? "PASS_FAIL" : "NUMERIC";
      const fresh = { ...modeSheet(nextMode), version: 7 };
      source.sheet.mockResolvedValueOnce(fresh);
      source.saveDraft.mockRejectedValueOnce(
        new ApiError(422, "GRADE_MODE_MISMATCH", {
          details: { gradingMode: nextMode, allowedMarks: fresh.allowedMarks },
        }),
      );
      const field = screen.getByRole("combobox", { name: /Grade for Luis/ });
      if (initialMode === "NUMERIC") await user.type(field, "2.00");
      else await user.selectOptions(field, "PASS");
      await user.click(screen.getByRole("button", { name: "Save draft" }));
      await screen.findByText(/The latest allowed marks have been loaded/);
      expect(source.sheet).toHaveBeenCalledTimes(2);
      expect(source.saveDraft).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
      const updated = screen.getByRole("combobox", { name: /Grade for Luis/ });
      expect(updated.tagName).toBe(nextMode === "PASS_FAIL" ? "SELECT" : "INPUT");
      expect(updated).toHaveValue("");
      const callback = interval.mock.calls.find(([, delay]) => delay === 60_000)?.[0];
      await act(async () => {
        if (typeof callback === "function") callback();
      });
      expect(source.saveDraft).toHaveBeenCalledTimes(1);
      await user.click(screen.getByRole("button", { name: "Review updated marks" }));
      if (nextMode === "PASS_FAIL") await user.selectOptions(updated, "FAIL");
      else await user.type(updated, "2.00");
      await user.click(screen.getByRole("button", { name: "Save draft" }));
      await waitFor(() =>
        expect(source.saveDraft).toHaveBeenLastCalledWith(
          "section-1",
          expect.objectContaining({ version: 7 }),
        ),
      );
    },
  );
  it.each(["NUMERIC", "PASS_FAIL"] as const)(
    "AC-FAC-003.2 / AC-FAC-003.3: a %s finalization mode mismatch never replays finalization",
    async (mode) => {
      const source = modeSource(mode, true);
      const { user } = await openPage(source);
      const nextMode = mode === "NUMERIC" ? "PASS_FAIL" : "NUMERIC";
      source.sheet.mockResolvedValueOnce(modeSheet(nextMode));
      source.finalize.mockRejectedValueOnce(new ApiError(422, "GRADE_MODE_MISMATCH"));
      await user.click(screen.getByRole("button", { name: "Submit final grades" }));
      await user.click(screen.getByRole("button", { name: "Confirm final submission" }));
      await screen.findByText(/The latest allowed marks have been loaded/);
      expect(source.finalize).toHaveBeenCalledTimes(1);
      expect(source.saveDraft).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Submit final grades" })).toBeDisabled();
    },
  );
  it("AC-FAC-003.2 negative: failed mismatch reload leaves writes paused with an explicit retry", async () => {
    const source = modeSource("PASS_FAIL");
    const { user } = await openPage(source);
    source.sheet.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR"));
    source.saveDraft.mockRejectedValueOnce(
      new ApiError(422, "GRADE_MODE_MISMATCH", { details: { gradingMode: "PASS_FAIL" } }),
    );
    await user.selectOptions(screen.getByRole("combobox", { name: /Grade for Luis/ }), "PASS");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByRole("button", { name: "Reload grades" });
    expect(screen.getByRole("alert")).toHaveTextContent("Pass or Fail");
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    expect(source.saveDraft).toHaveBeenCalledTimes(1);
  });
  it("AC-FAC-003.6: saves canonical Pass/Fail drafts, finalizes the saved version, and locks the grid", async () => {
    const source = modeSource("PASS_FAIL");
    const { user } = await openPage(source);
    await user.selectOptions(screen.getByRole("combobox", { name: /Grade for Luis/ }), "FAIL");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText(/Draft saved at/);
    expect(source.saveDraft).toHaveBeenCalledWith("section-1", {
      version: 1,
      grades: [
        { studentId: "student-1", mark: "PASS" },
        { studentId: "student-2", mark: "FAIL" },
        { studentId: "student-3", mark: "FAIL" },
      ],
    });
    await user.click(screen.getByRole("button", { name: "Submit final grades" }));
    expect(source.finalize).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirm final submission" }));
    await screen.findByText(/Grades submitted successfully/);
    expect(source.finalize).toHaveBeenCalledWith("section-1", 2);
    expect(source.saveDraft).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("combobox", { name: /Grade for Ana/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
  });
  it("AC-FAC-003.6: Pass/Fail autosave uses the latest choice", async () => {
    const interval = vi.spyOn(window, "setInterval");
    const source = modeSource("PASS_FAIL");
    const { user } = await openPage(source);
    await user.selectOptions(screen.getByRole("combobox", { name: /Grade for Luis/ }), "PASS");
    const callback = interval.mock.calls.find(([, delay]) => delay === 60_000)?.[0];
    await act(async () => {
      if (typeof callback === "function") callback();
    });
    expect(source.saveDraft).toHaveBeenCalledWith(
      "section-1",
      expect.objectContaining({
        grades: expect.arrayContaining([{ studentId: "student-2", mark: "PASS" }]),
      }),
    );
  });
  it("AC-FAC-003.6 negative: a blank Pass/Fail mark blocks finalization and focuses the student", async () => {
    const source = modeSource("PASS_FAIL");
    const { user } = await openPage(source);
    await user.click(screen.getByRole("button", { name: "Submit final grades" }));
    const field = screen.getByRole("combobox", { name: /Grade for Luis/ });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveFocus();
    expect(source.finalize).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it.each(["initial", "recheck", "refusal"])(
    "AC-FAC-003.6 boundary: Pass/Fail respects a deadline %s and keeps drafts editable",
    async (trigger) => {
      const source = modeSource("PASS_FAIL", true);
      const deadline = vi.spyOn(source, "deadline");
      if (trigger === "initial") deadline.mockResolvedValue({ deadline: null, passed: true });
      if (trigger === "recheck")
        deadline
          .mockResolvedValueOnce({ deadline: null, passed: false })
          .mockResolvedValue({ deadline: null, passed: true });
      if (trigger === "refusal")
        source.finalize.mockRejectedValueOnce(new ApiError(403, "GRADE_DEADLINE_PASSED"));
      const { user } = await openPage(source);
      if (trigger !== "initial") {
        await user.click(screen.getByRole("button", { name: "Submit final grades" }));
        await user.click(screen.getByRole("button", { name: "Confirm final submission" }));
      }
      await screen.findByText("The deadline has passed. Ask an administrator for an override.");
      expect(screen.getByRole("button", { name: "Submit final grades" })).toBeDisabled();
      expect(screen.getByRole("combobox", { name: /Grade for Luis/ })).not.toBeDisabled();
      expect(source.finalize).toHaveBeenCalledTimes(trigger === "refusal" ? 1 : 0);
    },
  );
  it.each(["draft", "finalize"])(
    "AC-FAC-003.6: GRADES_LOCKED on %s prevents further writes even if reloading fails",
    async (action) => {
      const source = modeSource("PASS_FAIL", true);
      const { user } = await openPage(source);
      source.sheet.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR"));
      if (action === "draft") {
        source.saveDraft.mockRejectedValueOnce(new ApiError(409, "GRADES_LOCKED"));
        await user.selectOptions(screen.getByRole("combobox", { name: /Grade for Luis/ }), "FAIL");
        await user.click(screen.getByRole("button", { name: "Save draft" }));
      } else {
        source.finalize.mockRejectedValueOnce(new ApiError(409, "GRADES_LOCKED"));
        await user.click(screen.getByRole("button", { name: "Submit final grades" }));
        await user.click(screen.getByRole("button", { name: "Confirm final submission" }));
      }
      await screen.findByText("These grades are final. Use Correction of Entry to change one.");
      expect(screen.getByRole("combobox", { name: /Grade for Luis/ })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Submit final grades" })).toBeDisabled();
      expect(source.saveDraft).toHaveBeenCalledTimes(action === "draft" ? 1 : 0);
      expect(source.finalize).toHaveBeenCalledTimes(action === "finalize" ? 1 : 0);
    },
  );
  it.each(["NUMERIC", "PASS_FAIL"] as const)(
    "AC-FAC-003.1: %s entry has no axe violations",
    async (mode) => {
      const { container } = await openPage(modeSource(mode));
      const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
      expect(results.violations).toEqual([]);
    },
  );
});
