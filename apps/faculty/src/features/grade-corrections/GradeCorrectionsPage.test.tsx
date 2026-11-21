import { createPortalRouter } from "@cbpupsis/account";
import { mockApi } from "@cbpupsis/account/testing";
import { ApiError } from "@cbpupsis/shared/api";
import type { Correction, CorrectionSource } from "@cbpupsis/shared/grades/corrections";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRoute, RouterProvider } from "@tanstack/react-router";
import { render, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import axe from "axe-core";
import { account, session } from "../../lib/auth";
import { me, signInDirectly } from "../../test/fixtures";
import { GradeCorrectionsPage } from "./GradeCorrectionsPage";
import { renderFaculty, sectionWire } from "../../test/renderFaculty";

const record: Correction = {
  id: "correction-1",
  version: 1,
  sectionId: "section-1",
  sectionLabel: "COMP 016 · BSCS 2-1",
  studentId: "student-1",
  studentName: "Ana Santos",
  studentNumber: "2026-00001",
  oldMark: "2.00",
  proposedMark: "1.50",
  reason: "Incorrect entry",
  state: "PENDING_CHAIR",
  remarks: null,
  filerId: "faculty-author",
  actedBy: [],
  sheetName: "grading.pdf",
  sheetUrl: null,
};
function sourceFor(state: Correction["state"] = "PENDING_CHAIR"): CorrectionSource {
  let item = { ...record, state };
  return {
    list: vi.fn(async () => [item]),
    detail: vi.fn(async () => item),
    sections: vi.fn(async () => [{ id: "section-1", label: "COMP 016" }]),
    students: vi.fn(async () => [
      { id: "student-1", name: "Ana Santos", studentNumber: "2026-00001", finalMark: "2.00" },
    ]),
    file: vi.fn(async () => ({ ...item, state: "PENDING_CHAIR" as const })),
    decide: vi.fn(async (_id, input) => {
      item = {
        ...item,
        version: item.version + 1,
        state:
          input.action === "REJECT"
            ? "REJECTED"
            : input.action === "COMMIT"
              ? "COMMITTED"
              : item.state === "PENDING_CHAIR"
                ? "PENDING_DEAN"
                : "PENDING_REGISTRAR",
        remarks: input.remarks,
      };
      return item;
    }),
  };
}

const original = {
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal"),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close"),
};
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.setAttribute("open", "");
      },
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.removeAttribute("open");
      },
    },
  });
});
afterEach(async () => {
  cleanup();
  for (const key of ["showModal", "close"] as const) {
    if (original[key]) Object.defineProperty(HTMLDialogElement.prototype, key, original[key]!);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
  }
  await session.signOut();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function open(source = sourceFor(), role = "chairperson") {
  signInDirectly();
  mockApi({
    "GET /auth/faculty/me": { status: 200, body: { ...me, position: role } },
    "GET /users/me": { status: 200, body: { full_name: "Reviewer", email: me.email } },
    "POST /auth/faculty/logout": { status: 204 },
  });
  const router = createPortalRouter({
    config: account,
    signIn: () => <p>Sign in</p>,
    dashboard: () => <p>Dashboard</p>,
    history: createMemoryHistory({ initialEntries: ["/grade-corrections"] }),
    extraRoutes: (root) => [
      createRoute({
        getParentRoute: () => root,
        path: "/grade-corrections",
        component: () => <GradeCorrectionsPage dataSource={source} />,
      }),
    ],
  });
  return {
    ...render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    source,
    user: userEvent.setup(),
  };
}

async function filing(source = sourceFor()) {
  const view = open(source);
  await view.user.click(await screen.findByRole("button", { name: "New correction" }));
  await waitFor(() => expect(screen.getByLabelText(/^Section/)).toBeEnabled());
  await view.user.selectOptions(screen.getByLabelText(/^Section/), "section-1");
  await waitFor(() => expect(screen.getByLabelText(/^Student/)).toBeEnabled());
  await view.user.selectOptions(screen.getByLabelText(/^Student/), "student-1");
  await view.user.type(screen.getByLabelText(/^New mark/), "1.5");
  await view.user.type(screen.getByLabelText(/^Reason/), "Entered incorrectly");
  await view.user.upload(
    screen.getByLabelText(/^Grading sheet/),
    new File(["sheet"], "grades.pdf", { type: "application/pdf" }),
  );
  return view;
}
it("AC-FAC-002.1: files at Chair without changing the recorded grade", async () => {
  const { user, source } = await filing();
  await user.click(screen.getByRole("button", { name: "File correction" }));
  await screen.findByText(/Correction filed/);
  expect(source.file).toHaveBeenCalledWith(
    expect.objectContaining({
      proposedMark: "1.50",
      reason: "Entered incorrectly",
      gradingSheet: expect.any(File),
    }),
  );
  expect(screen.getByText("2.00 → 1.50")).toBeInTheDocument();
  expect(source.decide).not.toHaveBeenCalled();
});
it.each([
  [403, "CORRECTION_WINDOW_CLOSED"],
  [413, "FILE_TOO_LARGE"],
  [415, "UNSUPPORTED_MEDIA_TYPE"],
] as const)("AC-FAC-002.4: handles refusal %s %s", async (status, code) => {
  const source = sourceFor();
  vi.mocked(source.file).mockRejectedValueOnce(new ApiError(status, code));
  const { user } = await filing(source);
  await user.click(screen.getByRole("button", { name: "File correction" }));
  if (status === 403) {
    await screen.findByText("The correction window for these grades has closed.");
    expect(screen.getByRole("button", { name: "File correction" })).toBeDisabled();
  } else
    await waitFor(() =>
      expect(screen.getByLabelText(/^Grading sheet/)).toHaveAttribute("aria-invalid", "true"),
    );
  expect(source.file).toHaveBeenCalledTimes(1);
});
it("AC-FAC-002.7: displays rejection remarks", async () => {
  const source = sourceFor("REJECTED");
  vi.mocked(source.list).mockResolvedValue([
    { ...record, state: "REJECTED", remarks: "Attach a signed grading sheet." },
  ]);
  open(source);
  await screen.findByText("Attach a signed grading sheet.");
});
it("validates required fields without sending an incomplete request", async () => {
  const { source, user } = open();
  await user.click(await screen.findByRole("button", { name: "New correction" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "File correction" })).toBeEnabled(),
  );
  await user.click(screen.getByRole("button", { name: "File correction" }));
  expect(source.file).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/^New mark/)).toHaveAttribute("aria-invalid", "true");
});

it("shows empty and retry states", async () => {
  const source = sourceFor();
  vi.mocked(source.list)
    .mockRejectedValueOnce(new ApiError(503, "CORRECTIONS_NOT_CONFIGURED"))
    .mockResolvedValue([]);
  const { user } = open(source);
  await user.click(await screen.findByRole("button", { name: "Retry corrections" }));
  await screen.findByText("No corrections match these filters.");
});
it("has no axe violations", async () => {
  const { container } = open();
  await screen.findByRole("button", { name: "View correction for Ana Santos" });
  expect(
    (await axe.run(container, { rules: { "color-contrast": { enabled: false } } })).violations,
  ).toEqual([]);
});

it("retries a failed section catalog without remounting the filing form", async () => {
  const source = sourceFor();
  vi.mocked(source.sections).mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR"));
  open(source);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "New correction" }));
  await user.click(await screen.findByRole("button", { name: "Retry eligible records" }));
  await waitFor(() => expect(source.sections).toHaveBeenCalledTimes(2));
  await user.selectOptions(screen.getByLabelText(/^Section/), "section-1");
  await waitFor(() => expect(source.students).toHaveBeenCalledWith("section-1"));
});
it("announces an empty section catalog rather than leaving an unusable form unexplained", async () => {
  const source = sourceFor();
  vi.mocked(source.sections).mockResolvedValue([]);
  open(source);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "New correction" }));
  expect(
    await screen.findByText("No assigned sections are available for correction."),
  ).toBeInTheDocument();
});

it("AC-FAC-002.1: the default live adapter files the published multipart contract and reads backend IDs", async () => {
  const wire = {
    id: "correction-live",
    gradeId: "grade-1",
    studentId: "student-1",
    sectionId: "section-1",
    facultyId: me.id,
    currentMark: "2.00",
    proposedMark: "1.50",
    reason: "Entered incorrectly",
    gradingSheetFileId: "private-file",
    gradingSheetContentType: "application/pdf",
    gradingSheetSize: 12,
    gradingSheetSha256: "a".repeat(64),
    state: "PENDING_CHAIR",
    version: 1,
    windowClosedAt: "2027-05-01T00:00:00Z",
    chairApprovedBy: null,
    deanApprovedBy: null,
    registrarApprovedBy: null,
    rejectedBy: null,
    rejectionRemarks: null,
    createdAt: "2026-11-19T01:00:00Z",
  };
  renderFaculty("/grade-corrections", {
    "GET /faculty/grade-corrections": {
      status: 200,
      body: { items: [], total: 0, limit: 100, offset: 0 },
    },
    "GET /faculty/sections": {
      status: 200,
      body: { items: [sectionWire], total: 1, limit: 200, offset: 0 },
    },
    "GET /faculty/sections/section-1/grades": {
      status: 200,
      body: {
        state: "FINAL",
        grades: [
          {
            studentId: "student-1",
            studentName: "Ana Santos",
            studentNumber: "2026-00001",
            finalGrade: "2.00",
            status: "FINAL",
            isDraft: false,
            isLocked: true,
          },
        ],
      },
    },
    "GET /faculty/grade-corrections/correction-live": { status: 200, body: wire },
  });
  const baseFetch = globalThis.fetch;
  let uploaded: FormData | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.body instanceof FormData) {
        uploaded = init.body;
        return new Response(JSON.stringify(wire), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }
      return baseFetch(input, init);
    }),
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "New correction" }));
  await waitFor(() => expect(screen.getByLabelText(/^Section/)).toBeEnabled());
  await user.selectOptions(screen.getByLabelText(/^Section/), "section-1");
  await waitFor(() => expect(screen.getByLabelText(/^Student/)).toBeEnabled());
  await user.selectOptions(screen.getByLabelText(/^Student/), "student-1");
  await user.type(screen.getByLabelText(/^New mark/), "1.50");
  await user.type(screen.getByLabelText(/^Reason/), "Entered incorrectly");
  await user.upload(
    screen.getByLabelText(/^Grading sheet/),
    new File(["%PDF-evidence"], "evidence.pdf", { type: "application/pdf" }),
  );
  await user.click(screen.getByRole("button", { name: "File correction" }));
  await screen.findByText(/Correction filed/);
  expect(uploaded?.get("student_id")).toBe("student-1");
  expect(uploaded?.get("proposed_mark")).toBe("1.50");
  expect(uploaded?.get("grading_sheet")).toBeInstanceOf(File);
  await user.click(screen.getByRole("button", { name: "View correction for Ana Santos" }));
  await screen.findByRole("dialog", { name: "Correction details" });
  expect(screen.getByRole("dialog")).toHaveTextContent("Student ID: student-1");
  expect(screen.getByRole("dialog")).toHaveTextContent("Section ID: section-1");
  expect(screen.getByRole("dialog")).toHaveTextContent(
    "Document download is currently unavailable.",
  );
});
