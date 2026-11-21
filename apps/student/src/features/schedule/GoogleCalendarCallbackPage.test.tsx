import { mockApi } from "@cbpupsis/account/testing";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { expectNoA11yViolations } from "../../test/axe";
import {
  CALLBACK_ROUTE,
  CALENDAR_ROUTE,
  calendarStatus,
  calendarTestDom,
  connectedCalendar,
  mockCalendarApi,
  renderCalendarApp,
  SYNC_ROUTE,
} from "../../test/googleCalendarFixtures";
import { GOOGLE_CALENDAR_MESSAGES } from "./googleCalendar";

const state = "test-state-".repeat(4);
const code = "new+code%2Fwith&characters";
const callbackUrl = "/calendar/google/callback?" + new URLSearchParams({ state, code }).toString();
let restoreDom: () => void;
beforeEach(() => {
  restoreDom = calendarTestDom();
});
afterEach(async () => {
  cleanup();
  restoreDom();
  mockApi({ "POST /auth/student/logout": { status: 204 } });
  await session.signOut();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("GoogleCalendarCallbackPage (US-STU-005)", () => {
  it("AC-STU-005.1, AC-STU-005.4: connects the selected Google account and shows its automatically queued first sync", async () => {
    const queuedConnection = { ...connectedCalendar, last_sync_at: null };
    const api = mockCalendarApi({
      [CALLBACK_ROUTE]: { status: 200, body: queuedConnection },
      [CALENDAR_ROUTE]: { status: 200, body: queuedConnection },
    });
    const view = renderCalendarApp(callbackUrl, true);
    await screen.findByRole("heading", { name: "Course Schedule" });
    expect(api.called(CALLBACK_ROUTE)).toEqual([
      expect.objectContaining({ body: { state, code }, authorization: "Bearer access-1" }),
    ]);
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Manage Google Calendar" }));
    await screen.findByText("Connected", { exact: true });
    expect(screen.getByText("Sync queued", { exact: true })).toBeInTheDocument();
    // The backend callback already queues the first sync; do not submit a duplicate job.
    expect(api.called(SYNC_ROUTE)).toHaveLength(0);
    expect(view.router.state.location.searchStr).toBe("");
    expect(document.body.textContent).not.toContain(code);
    expect(
      JSON.stringify(
        view.client
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data),
      ),
    ).not.toContain(state);
    expect(
      view.client
        .getMutationCache()
        .getAll()
        .some((mutation) => JSON.stringify(mutation.state).includes(code)),
    ).toBe(false);
  });

  it("AC-STU-005.1: StrictMode and repeated renders do not resubmit a pending callback", async () => {
    const api = mockCalendarApi({ [CALLBACK_ROUTE]: "pending" });
    const view = renderCalendarApp(callbackUrl, true);
    await waitFor(() => expect(api.called(CALLBACK_ROUTE)).toHaveLength(1));
    view.rerenderPage();
    view.rerenderPage();
    expect(api.called(CALLBACK_ROUTE)).toHaveLength(1);
    expect(screen.getByText("Completing your Google Calendar connection…")).toBeInTheDocument();
    await waitFor(() => expect(view.router.state.location.searchStr).toBe(""));
  });

  it.each([
    [400, "GOOGLE_CALENDAR_INVALID_STATE", GOOGLE_CALENDAR_MESSAGES.invalidState, "AC-STU-005.2"],
    [503, "GOOGLE_CALENDAR_UNAVAILABLE", GOOGLE_CALENDAR_MESSAGES.unavailable, "AC-STU-005.15"],
    [409, "GOOGLE_CALENDAR_CONFLICT", GOOGLE_CALENDAR_MESSAGES.conflict, "AC-STU-005.11"],
  ] as const)("%s %s: safe recovery message (%s, %s)", async (status, errorCode, message, _ac) => {
    const api = mockCalendarApi({
      [CALLBACK_ROUTE]: {
        status,
        body: { code: errorCode, detail: "PRIVATE-GOOGLE-ID PRIVATE-GOOGLE-TOKEN" },
      },
    });
    const view = renderCalendarApp(callbackUrl, true);
    await screen.findByText(message);
    view.rerenderPage();
    expect(api.called(CALLBACK_ROUTE)).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Back to schedule" })).toHaveAttribute(
      "href",
      "/schedule",
    );
    expect(document.body.textContent).not.toMatch(/PRIVATE-GOOGLE|new\+code/);
    await waitFor(() => expect(view.router.state.location.searchStr).toBe(""));
  });

  it.each([
    "/calendar/google/callback",
    "/calendar/google/callback?state=short&code=test",
    `/calendar/google/callback?state=${state}&code=one&code=two`,
  ])("AC-STU-005.2: incomplete or ambiguous redirects are not forwarded (%s)", async (path) => {
    const api = mockCalendarApi();
    const view = renderCalendarApp(path, true);
    await screen.findByText(GOOGLE_CALENDAR_MESSAGES.invalidState);
    expect(api.called(CALLBACK_ROUTE)).toHaveLength(0);
    await waitFor(() => expect(view.router.state.location.searchStr).toBe(""));
  });

  it("AC-STU-005.2: denied consent is scrubbed without displaying Google's details", async () => {
    const api = mockCalendarApi();
    const view = renderCalendarApp(
      "/calendar/google/callback?error=access_denied&error_description=PRIVATE-GOOGLE-TOKEN",
      true,
    );
    await screen.findByText("Google Calendar was not connected. Please connect again.");
    expect(api.called(CALLBACK_ROUTE)).toHaveLength(0);
    expect(document.body).not.toHaveTextContent("PRIVATE-GOOGLE-TOKEN");
    await waitFor(() => expect(view.router.state.location.searchStr).toBe(""));
  });

  it("AC-STU-005.2: an expired SIS session cannot submit or retain the handoff", async () => {
    const api = mockCalendarApi({}, false);
    const view = renderCalendarApp(callbackUrl, true);
    await screen.findByText("Your student session has ended. Sign in, then connect again.");
    expect(api.called(CALLBACK_ROUTE)).toHaveLength(0);
    await waitFor(() => expect(view.router.state.location.searchStr).toBe(""));
  });

  it("AC-STU-005.11: a failed callback marks cached Google Calendar status stale", async () => {
    mockCalendarApi({
      [CALLBACK_ROUTE]: { status: 409, body: { code: "GOOGLE_CALENDAR_CONFLICT" } },
    });
    const view = renderCalendarApp(callbackUrl, true);
    const invalidate = vi.spyOn(view.client, "invalidateQueries");
    await screen.findByText(GOOGLE_CALENDAR_MESSAGES.conflict);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["google-calendar"] });
  });

  it("AC-STU-005.1: rerendering after success still sends the callback exactly once", async () => {
    const api = mockCalendarApi({ [CALLBACK_ROUTE]: { status: 200, body: connectedCalendar } });
    const view = renderCalendarApp(callbackUrl, true);
    await screen.findByRole("heading", { name: "Course Schedule" });
    view.rerenderPage();
    view.rerenderPage();
    expect(api.called(CALLBACK_ROUTE)).toHaveLength(1);
    expect(view.router.state.location.pathname).toBe("/schedule");
  });

  it("AC-STU-005.15: failure page passes axe and provides a keyboard-accessible return link", async () => {
    mockCalendarApi({
      [CALLBACK_ROUTE]: { status: 503, body: { code: "GOOGLE_CALENDAR_UNAVAILABLE" } },
    });
    const { container } = renderCalendarApp(callbackUrl);
    await screen.findByText(GOOGLE_CALENDAR_MESSAGES.unavailable);
    await expectNoA11yViolations(container);
    const link = screen.getByRole("link", { name: "Back to schedule" });
    link.focus();
    expect(link).toHaveFocus();
  });

  it("AC-STU-005.9: reloading a scrubbed callback cannot replay the code", async () => {
    const api = mockCalendarApi({ [CALLBACK_ROUTE]: { status: 200, body: calendarStatus } });
    const view = renderCalendarApp(callbackUrl);
    await screen.findByRole("heading", { name: "Course Schedule" });
    await view.router.navigate({ to: "/calendar/google/callback", search: {} });
    await screen.findByText(GOOGLE_CALENDAR_MESSAGES.invalidState);
    expect(api.called(CALLBACK_ROUTE)).toHaveLength(1);
  });
});
