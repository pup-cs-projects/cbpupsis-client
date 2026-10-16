import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import {
  LOGOUT_ROUTE,
  ME_ROUTE,
  PORTAL_HEADING,
  SIGNED_IN_TEXT,
  me,
  signInDirectly,
} from "../../test/fixtures";
import { mockApi } from "../../test/mockApi";
import { renderApp } from "../../test/renderApp";

const minutes = (count: number) => count * 60_000;

/** Let the page's clocks run for `ms` of fake time. */
const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

const dialog = () => screen.queryByRole("alertdialog", { name: "Your session is about to end" });

async function openDashboard() {
  const api = mockApi({ [ME_ROUTE]: { status: 200, body: me }, [LOGOUT_ROUTE]: { status: 204 } });
  signInDirectly();
  renderApp("/dashboard");
  await screen.findByText(SIGNED_IN_TEXT);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  return { api, user };
}

beforeEach(() => {
  // Real time keeps flowing too, so Testing Library's own waiting still works.
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(async () => {
  mockApi({ [LOGOUT_ROUTE]: { status: 204 } });
  await session.signOut();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("idle warning (FR1)", () => {
  it("stays hidden for the first 10 minutes without activity", async () => {
    await openDashboard();

    await wait(minutes(10) - 2_000);

    expect(dialog()).not.toBeInTheDocument();
  });

  it("warns 5 minutes before the 15 minute sign-out, focused on staying, over an inert page", async () => {
    await openDashboard();

    await wait(minutes(10));

    expect(dialog()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stay signed in" })).toHaveFocus();
    expect(screen.getByRole("timer")).toHaveTextContent(/^(5:00|4:59)$/);
    expect(document.querySelector(".app-frame")).toHaveAttribute("inert");
  });

  it("counts down live, second by second", async () => {
    await openDashboard();
    await wait(minutes(10));
    const before = screen.getByRole("timer").textContent;

    await wait(61_000);

    expect(screen.getByRole("timer").textContent).not.toBe(before);
    expect(screen.getByRole("timer")).toHaveTextContent(/^(3:59|3:58)$/);
  });

  it("announces once when less than a minute is left", async () => {
    await openDashboard();
    await wait(minutes(10));
    expect(screen.queryByText("Less than one minute left before sign-out.")).toBeNull();

    await wait(minutes(4) + 2_000);

    expect(screen.getByText("Less than one minute left before sign-out.")).toBeInTheDocument();
  });

  it("keeps the session on the API when the person stays, and gives focus back", async () => {
    const { api, user } = await openDashboard();
    const signOut = screen.getByRole("button", { name: "Sign out" });
    signOut.focus();
    await wait(minutes(10));

    await user.click(screen.getByRole("button", { name: "Stay signed in" }));

    await waitFor(() => expect(dialog()).not.toBeInTheDocument());
    expect(api.called(ME_ROUTE)).toHaveLength(2);
    expect(signOut).toHaveFocus();
    expect(document.querySelector(".app-frame")).not.toHaveAttribute("inert");

    // The clock starts over from that request.
    await wait(minutes(9));
    expect(dialog()).not.toBeInTheDocument();
  });

  it("treats Escape as staying", async () => {
    const { api, user } = await openDashboard();
    await wait(minutes(10));

    await user.keyboard("{Escape}");

    await waitFor(() => expect(dialog()).not.toBeInTheDocument());
    expect(api.called(ME_ROUTE)).toHaveLength(2);
  });

  it("keeps Tab inside the dialog", async () => {
    const { user } = await openDashboard();
    await wait(minutes(10));
    const stay = screen.getByRole("button", { name: "Stay signed in" });
    const leave = screen.getByRole("button", { name: "Sign out now" });

    await user.tab();
    expect(leave).toHaveFocus();
    await user.tab();
    expect(stay).toHaveFocus();
    await user.tab({ shift: true });
    expect(leave).toHaveFocus();
  });

  it("signs out when time runs out and says why on the sign-in page", async () => {
    const { api } = await openDashboard();

    await wait(minutes(15));

    expect(await screen.findByRole("heading", { name: PORTAL_HEADING })).toBeInTheDocument();
    expect(screen.getByText(/signed out after 15 minutes of inactivity/)).toHaveAttribute(
      "role",
      "status",
    );
    expect(api.called(LOGOUT_ROUTE)).toHaveLength(1);
    expect(session.isSignedIn()).toBe(false);
  });

  it("counts from the latest request the API answered, not from sign-in", async () => {
    const { user } = await openDashboard();
    await wait(minutes(8));

    // Any authenticated request restarts the API's idle clock.
    await act(() => session.authorized(async () => "ok"));
    await wait(minutes(4));
    expect(dialog()).not.toBeInTheDocument();

    await wait(minutes(6) + 2_000);
    expect(dialog()).toBeInTheDocument();
    await user.keyboard("{Escape}");
  });

  it("signs out at once on request", async () => {
    const { user, api } = await openDashboard();
    await wait(minutes(10));

    await user.click(screen.getByRole("button", { name: "Sign out now" }));

    expect(await screen.findByRole("heading", { name: PORTAL_HEADING })).toBeInTheDocument();
    expect(screen.queryByText(/inactivity/)).not.toBeInTheDocument();
    expect(api.called(LOGOUT_ROUTE)).toHaveLength(1);
  });

  it("never runs while signed out", async () => {
    mockApi({});
    renderApp("/");
    await screen.findByRole("heading", { name: PORTAL_HEADING });

    await wait(minutes(20));

    expect(dialog()).not.toBeInTheDocument();
  });
});
