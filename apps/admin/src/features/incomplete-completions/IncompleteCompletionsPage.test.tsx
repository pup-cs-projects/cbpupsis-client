import { createPortalRouter } from "@cbpupsis/account";
import { mockApi } from "@cbpupsis/account/testing";
import { ApiError } from "@cbpupsis/shared/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRoute, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { account, session } from "../../lib/auth";
import { me, signInDirectly } from "../../test/fixtures";
import { completionFixture, createReviewFixtureSource } from "../../test/incompleteFixtures";
import { IncompleteCompletionsPage } from "./IncompleteCompletionsPage";
import type { IncompleteReviewDataSource } from "./dataSource";

const methods = {
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
  for (const name of ["showModal", "close"] as const) {
    if (methods[name]) Object.defineProperty(HTMLDialogElement.prototype, name, methods[name]!);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
  await session.signOut();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function openPage(
  position = "dean",
  source: IncompleteReviewDataSource = createReviewFixtureSource(),
) {
  signInDirectly();
  mockApi({
    "GET /admin/me": { status: 200, body: { ...me, position, college_id: "college-1" } },
    "GET /users/me": { status: 200, body: { full_name: "Dean Maria Santos", email: me.email } },
    "POST /auth/admin/logout": { status: 204 },
  });
  const router = createPortalRouter({
    config: account,
    signIn: () => <p>Sign in</p>,
    dashboard: () => <p>Dashboard</p>,
    history: createMemoryHistory({ initialEntries: ["/incomplete-completions"] }),
    extraRoutes: (root) => [
      createRoute({
        getParentRoute: () => root,
        path: "/incomplete-completions",
        component: () => <IncompleteCompletionsPage dataSource={source} />,
      }),
    ],
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    ...render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    source,
    user: userEvent.setup(),
  };
}
async function openReview(source = createReviewFixtureSource()) {
  const view = openPage("dean", source);
  await view.user.click(await screen.findByRole("button", { name: /Review completion for Carlo/ }));
  await screen.findByLabelText("Review remarks");
  return view;
}

describe("Dean Inc completions (US-FAC-001)", () => {
  it.each(["chairperson", "registrar", "finance"])(
    "does not load completion records for %s",
    async (role) => {
      const source = createReviewFixtureSource();
      const list = vi.spyOn(source, "list");
      openPage(role, source);
      await screen.findByText("This page is not available to your role.");
      expect(list).not.toHaveBeenCalled();
      expect(screen.queryByText("Carlo Cruz")).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Inc completions" })).not.toBeInTheDocument();
    },
  );
  it("AC-FAC-001.5: endorses only after review and sends the loaded version", async () => {
    const source = createReviewFixtureSource();
    const decide = vi.spyOn(source, "decide");
    const { user } = await openReview(source);
    expect(decide).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Endorse completion" }));
    await screen.findByText(/Completion endorsed/);
    expect(decide).toHaveBeenCalledWith("completion-1", {
      version: 7,
      decision: "ENDORSE",
      remarks: "",
    });
  });
  it("requires rejection remarks and shows server field validation on the remarks field", async () => {
    const source = createReviewFixtureSource();
    const decide = vi.spyOn(source, "decide");
    const { user } = await openReview(source);
    await user.click(screen.getByRole("button", { name: "Reject completion" }));
    expect(decide).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Review remarks")).toHaveAttribute("aria-invalid", "true");
    await user.type(screen.getByLabelText("Review remarks"), "Please attach the signed form.");
    decide.mockRejectedValueOnce(new ApiError(422, "DECISION_REMARKS_REQUIRED"));
    await user.click(screen.getByRole("button", { name: "Reject completion" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Review remarks")).toHaveAttribute("aria-invalid", "true"),
    );
    expect(decide).toHaveBeenCalledTimes(1);
  });
  it("handles a version conflict without replaying and reloads details before another decision", async () => {
    const source = createReviewFixtureSource();
    const decide = vi
      .spyOn(source, "decide")
      .mockRejectedValueOnce(new ApiError(409, "VERSION_CONFLICT"));
    const detail = vi.spyOn(source, "detail");
    const { user } = await openReview(source);
    await user.click(screen.getByRole("button", { name: "Endorse completion" }));
    await screen.findByText("These grades changed in another window. Reload to continue.");
    expect(decide).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Endorse completion" })).toBeDisabled();
    detail.mockResolvedValueOnce({ ...completionFixture, version: 8 });
    await user.click(screen.getByRole("button", { name: "Reload completion" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Endorse completion" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Endorse completion" }));
    await waitFor(() =>
      expect(decide).toHaveBeenLastCalledWith(
        "completion-1",
        expect.objectContaining({ version: 8 }),
      ),
    );
  });
  it("does not display records when the API rejects the Dean's access", async () => {
    const source = createReviewFixtureSource();
    vi.spyOn(source, "list").mockRejectedValue(new ApiError(403, "FORBIDDEN"));
    openPage("dean", source);
    await screen.findByText("This page is not available to your role.");
    expect(screen.queryByText("Carlo Cruz")).not.toBeInTheDocument();
  });
  it("clears the list if access is revoked while opening completion details", async () => {
    const source = createReviewFixtureSource();
    vi.spyOn(source, "detail").mockRejectedValue(new ApiError(403, "FORBIDDEN"));
    const decide = vi.spyOn(source, "decide");
    const { user } = openPage("dean", source);
    await user.click(await screen.findByRole("button", { name: /Review completion for Carlo/ }));
    await screen.findByText("This page is not available to your role.");
    await waitFor(() => expect(screen.queryByText("Carlo Cruz")).not.toBeInTheDocument());
    expect(decide).not.toHaveBeenCalled();
  });
  it("does not render unsafe completion-form links and has no axe violations", async () => {
    const source = createReviewFixtureSource();
    vi.spyOn(source, "detail").mockResolvedValue({
      ...completionFixture,
      formUrl: "javascript:alert(1)",
    });
    const { container } = await openReview(source);
    expect(screen.queryByRole("link", { name: "completion-form.pdf" })).not.toBeInTheDocument();
    expect(
      (await axe.run(container, { rules: { "color-contrast": { enabled: false } } })).violations,
    ).toEqual([]);
  });
  it("shows an empty state and retries an unavailable list", async () => {
    const source = createReviewFixtureSource();
    vi.spyOn(source, "list")
      .mockRejectedValueOnce(new ApiError(503, "GRADING_NOT_CONFIGURED"))
      .mockResolvedValue([]);
    const { user } = openPage("dean", source);
    await user.click(await screen.findByRole("button", { name: "Retry completions" }));
    await screen.findByText("No completion requests match these filters.");
  });
});
