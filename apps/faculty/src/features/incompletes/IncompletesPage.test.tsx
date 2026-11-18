import { ApiError } from "@cbpupsis/shared/api";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { session } from "../../lib/auth";
import { createGradingFixtureSource } from "../../test/gradingFixtures";
import { installGradingDialogDom, renderGrading } from "../../test/renderGrading";
import { IncompletesPage } from "./IncompletesPage";
let restore: () => void;
beforeEach(() => {
  restore = installGradingDialogDom();
});
afterEach(async () => {
  cleanup();
  restore();
  await session.signOut();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function openForm(source = createGradingFixtureSource()) {
  renderGrading(<IncompletesPage dataSource={source} />, "/incompletes");
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /File completion for Carlo/ }));
  return { source, user };
}
describe("Faculty Incompletes (US-FAC-001)", () => {
  it("AC-FAC-001.5: requires a passing mark and form, then waits for Dean approval", async () => {
    const source = createGradingFixtureSource();
    const complete = vi.spyOn(source, "complete");
    const { user } = await openForm(source);
    await user.click(screen.getByRole("button", { name: "File completion request" }));
    expect(complete).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText("Completion mark"), "3.25");
    await user.upload(
      screen.getByLabelText("Completion form"),
      new File(["approved form"], "completion.pdf", { type: "application/pdf" }),
    );
    await user.click(screen.getByRole("button", { name: "File completion request" }));
    expect(complete).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Completion mark"));
    await user.type(screen.getByLabelText("Completion mark"), "2.5");
    await user.click(screen.getByRole("button", { name: "File completion request" }));
    await screen.findByText(/The recorded mark remains Inc/);
    expect(complete).toHaveBeenCalledWith("inc-1", { mark: "2.50", form: expect.any(File) });
    expect(screen.getByText("Awaiting Dean")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /File completion for Carlo/ })).toBeDisabled();
  });
  it("AC-FAC-001.7: a closed completion window blocks resubmission", async () => {
    const source = createGradingFixtureSource();
    const complete = vi
      .spyOn(source, "complete")
      .mockRejectedValue(new ApiError(409, "INC_COMPLETION_WINDOW_CLOSED"));
    const { user } = await openForm(source);
    await user.type(screen.getByLabelText("Completion mark"), "2.00");
    await user.upload(screen.getByLabelText("Completion form"), new File(["form"], "form.pdf"));
    await user.click(screen.getByRole("button", { name: "File completion request" }));
    await screen.findByText("The completion period for this Inc has ended.");
    expect(screen.getByRole("button", { name: "File completion request" })).toBeDisabled();
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it("shows an empty state and can retry a failed list without fabricating cases", async () => {
    const source = createGradingFixtureSource();
    const list = vi
      .spyOn(source, "incompletes")
      .mockRejectedValueOnce(new ApiError(503, "GRADING_NOT_CONFIGURED"))
      .mockResolvedValue([]);
    renderGrading(<IncompletesPage dataSource={source} />, "/incompletes");
    const retry = await screen.findByRole("button", { name: "Retry Incompletes" });
    await userEvent.setup().click(retry);
    await screen.findByText("No Incomplete grades match these filters.");
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });
});
