import { createPortalRouter } from "@cbpupsis/account";
import { mockApi } from "@cbpupsis/account/testing";
import { ApiError } from "@cbpupsis/shared/api";
import type { Correction, CorrectionSource } from "@cbpupsis/shared/grades/corrections";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRoute, RouterProvider } from "@tanstack/react-router";
import { act, render, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import axe from "axe-core";
import { account, session } from "../../lib/auth";
import { me, signInDirectly } from "../../test/fixtures";
import { GradeCorrectionsPage } from "./GradeCorrectionsPage";

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
function open(
  source = sourceFor(),
  role = "chairperson",
  apiRoutes?: Parameters<typeof mockApi>[0],
) {
  signInDirectly();
  const http = mockApi({
    "GET /admin/me": { status: 200, body: { ...me, position: role } },
    "GET /users/me": { status: 200, body: { full_name: "Reviewer", email: me.email } },
    "POST /auth/admin/logout": { status: 204 },
    ...apiRoutes,
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
        component: () => <GradeCorrectionsPage dataSource={apiRoutes ? undefined : source} />,
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
    ...http,
    user: userEvent.setup(),
  };
}

it.each(["chairperson", "dean", "registrar", "finance"])(
  "renders the correct access for %s",
  async (role) => {
    const state =
      role === "dean"
        ? "PENDING_DEAN"
        : role === "registrar"
          ? "PENDING_REGISTRAR"
          : "PENDING_CHAIR";
    const { source, user } = open(sourceFor(state), role);
    if (role === "finance") {
      await screen.findByText("This page is not available to your role.");
      expect(source.list).not.toHaveBeenCalled();
      return;
    }
    await user.click(await screen.findByRole("button", { name: "View correction for Ana Santos" }));
    await screen.findByRole("dialog");
    expect(
      screen.getByRole("button", { name: role === "registrar" ? "Commit correction" : "Endorse" }),
    ).toBeEnabled();
  },
);
it.each(["chairperson", "dean", "registrar"])(
  "AC-FAC-002.2, AC-FAC-002.3: %s sends only its step action",
  async (role) => {
    const source = sourceFor(
      role === "dean"
        ? "PENDING_DEAN"
        : role === "registrar"
          ? "PENDING_REGISTRAR"
          : "PENDING_CHAIR",
    );
    const { user } = open(source, role);
    await user.click(await screen.findByRole("button", { name: "View correction for Ana Santos" }));
    await user.click(
      await screen.findByRole("button", {
        name: role === "registrar" ? "Commit correction" : "Endorse",
      }),
    );
    await waitFor(() =>
      expect(source.decide).toHaveBeenCalledWith(record.id, {
        action: role === "registrar" ? "COMMIT" : "ENDORSE",
        remarks: "",
        version: 1,
      }),
    );
  },
);
it("AC-FAC-002.7: rejection requires remarks", async () => {
  const { source, user } = open();
  await user.click(await screen.findByRole("button", { name: "View correction for Ana Santos" }));
  await user.click(await screen.findByRole("button", { name: "Reject" }));
  expect(source.decide).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/^Decision remarks/)).toHaveAttribute("aria-invalid", "true");
  await user.type(screen.getByLabelText(/^Decision remarks/), "Missing signature");
  await user.click(screen.getByRole("button", { name: "Reject" }));
  await screen.findByText("Correction rejected. The recorded grade is unchanged.");
});
it.each(["APPROVAL_SAME_ACTOR", "APPROVAL_OUT_OF_ORDER"])(
  "AC-FAC-002.5, AC-FAC-002.6: handles %s without replay",
  async (code) => {
    const source = sourceFor();
    vi.mocked(source.decide).mockRejectedValueOnce(
      new ApiError(code === "APPROVAL_SAME_ACTOR" ? 403 : 409, code),
    );
    const { user } = open(source);
    await user.click(await screen.findByRole("button", { name: "View correction for Ana Santos" }));
    await user.click(await screen.findByRole("button", { name: "Endorse" }));
    await screen.findByText(
      code === "APPROVAL_SAME_ACTOR"
        ? "You already acted on this correction."
        : "This correction is not at your step.",
    );
    expect(source.decide).toHaveBeenCalledTimes(1);
    if (code === "APPROVAL_OUT_OF_ORDER")
      await waitFor(() => expect(source.detail).toHaveBeenCalledTimes(2));
  },
);

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

it("returns keyboard focus to the triggering row after an asynchronous details load", async () => {
  const source = sourceFor();
  let complete!: (value: Correction) => void;
  vi.mocked(source.detail).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const { user } = open(source);
  const trigger = await screen.findByRole("button", { name: "View correction for Ana Santos" });
  await user.click(trigger);
  await waitFor(() => expect(trigger).toBeDisabled());
  trigger.blur();
  await act(async () => complete(record));
  const dialog = await screen.findByRole("dialog");
  // jsdom does not implement the native dialog cancel event produced by Escape.
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  await waitFor(() => expect(trigger).toHaveFocus());
});

it.each(["chairperson", "dean", "registrar", "finance"])(
  "AC-FAC-002.2/.3: the published adapter uses admin-only records and decisions for %s",
  async (role) => {
    const state =
      role === "dean"
        ? "PENDING_DEAN"
        : role === "registrar"
          ? "PENDING_REGISTRAR"
          : "PENDING_CHAIR";
    const wire = {
      id: "live-correction",
      gradeId: "grade-1",
      studentId: "student-1",
      sectionId: "section-1",
      facultyId: "faculty-author",
      currentMark: "2.00",
      proposedMark: "1.50",
      reason: "Transcription error",
      gradingSheetFileId: "private-file",
      gradingSheetContentType: "application/pdf",
      gradingSheetSize: 2048,
      state,
      version: 1,
      chairApprovedBy: role === "dean" || role === "registrar" ? "other-chair" : null,
      deanApprovedBy: role === "registrar" ? "other-dean" : null,
      registrarApprovedBy: null,
      rejectedBy: null,
      rejectionRemarks: null,
      windowClosedAt: "2027-05-01T00:00:00Z",
      createdAt: "2026-11-19T01:00:00Z",
    };
    const updated = {
      ...wire,
      state:
        role === "registrar" ? "COMMITTED" : role === "dean" ? "PENDING_REGISTRAR" : "PENDING_DEAN",
      version: 2,
      ...(role === "registrar"
        ? { registrarApprovedBy: me.id }
        : role === "dean"
          ? { deanApprovedBy: me.id }
          : { chairApprovedBy: me.id }),
    };
    const { user, called, calls } = open(sourceFor(), role, {
      "GET /admin/grade-corrections": {
        status: 200,
        body: { items: [wire], total: 1, limit: 100, offset: 0 },
      },
      "GET /admin/grade-corrections/live-correction": { status: 200, body: wire },
      "PATCH /admin/grade-corrections/live-correction": { status: 200, body: updated },
    });
    if (role === "finance") {
      await screen.findByText("This page is not available to your role.");
      expect(called("GET /admin/grade-corrections")).toHaveLength(0);
      return;
    }
    await user.click(
      await screen.findByRole("button", { name: "View correction for Student ID: student-1" }),
    );
    await screen.findByRole("dialog");
    expect(screen.getByRole("dialog")).toHaveTextContent("Section ID: section-1");
    expect(screen.queryByText("Ana Santos")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: role === "registrar" ? "Commit correction" : "Endorse" }),
    );
    await screen.findByText(
      role === "registrar"
        ? /Correction committed\./
        : /Correction endorsed for the next approval step\./,
    );
    expect(called("PATCH /admin/grade-corrections/live-correction")[0]?.body).toEqual({
      action: role === "registrar" ? "COMMIT" : "ENDORSE",
      version: 1,
    });
    expect(calls.some((call) => call.route.includes("/faculty/"))).toBe(false);
  },
);
