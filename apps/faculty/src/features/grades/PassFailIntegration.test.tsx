import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { session } from "../../lib/auth";
import { renderFaculty } from "../../test/renderFaculty";
const sheet = {
  sectionId: "section-1",
  sectionName: "BSCS 2-1",
  courseCode: "NSTP 002",
  courseTitle: "National Service Training Program",
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
afterEach(async () => {
  cleanup();
  await session.signOut();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("AC-FAC-003.1/.6: the live adapter offers Pass and Fail and writes PASS as a versioned draft", async () => {
  const view = renderFaculty("/sections/section-1/grades", {
    "GET /faculty/sections/section-1/grades": { status: 200, body: sheet },
    "GET /faculty/sections/section-1/grade-deadline": {
      status: 200,
      body: { deadline: "2030-01-15T12:00:00Z", passed: false },
    },
    "PUT /faculty/sections/section-1/grades/draft": {
      status: 200,
      body: { ...sheet, version: 2, grades: [{ ...sheet.grades[0], finalGrade: "PASS" }] },
    },
  });
  const choice = await screen.findByRole("combobox", { name: /Grade for Ana Santos/ });
  expect(screen.getByRole("option", { name: "Pass" })).toBeInTheDocument();
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  await userEvent.selectOptions(choice, "PASS");
  await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await screen.findByText(/Draft saved at/);
  expect(view.called("PUT /faculty/sections/section-1/grades/draft")[0]?.body).toEqual({
    version: 1,
    grades: [{ studentId: "student-1", finalGrade: "PASS" }],
  });
});
