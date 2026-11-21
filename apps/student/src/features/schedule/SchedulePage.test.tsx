import { mockApi } from "@cbpupsis/account/testing";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { session } from "../../lib/auth";
import { expectNoA11yViolations } from "../../test/axe";
import {
  AUTHORIZE_ROUTE,
  CALENDAR_ROUTE,
  calendarStatus,
  calendarTestDom,
  connectedCalendar,
  DISCONNECT_ROUTE,
  mockCalendarApi,
  renderCalendarApp,
  SYNC_ROUTE,
} from "../../test/googleCalendarFixtures";
import { calendarNavigation, GOOGLE_CALENDAR_MESSAGES } from "./googleCalendar";

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
  vi.unstubAllEnvs();
});
const twoTerms = {
  ...connectedCalendar,
  targets: [
    { year: "2026-2027", semester: "first", provisioned: true },
    { year: "2025-2026", semester: "second", provisioned: true },
  ],
};
const calendar = () => screen.getByRole("region", { name: "Google Calendar" });
const connectButton = () =>
  screen.getByRole("button", { name: /Connect to Google Calendar to sync/ });
const manageButton = () => screen.queryByRole("button", { name: "Manage Google Calendar" });
/** High-contrast and active, never the muted grey of a disabled control. */
function expectActiveConnect(button: HTMLElement) {
  expect(button).toBeEnabled();
  expect(button.className).toMatch(/\btext-brand-maroon\b/);
  expect(button.className).toMatch(/\bborder-brand-maroon\b/);
  expect(button.className).not.toMatch(/text-brand-input-text/);
}
const disconnectDialog = () => screen.getByRole("dialog", { name: "Disconnect Google Calendar?" });
/** Google Calendar details live in a pop-up; open it from the Manage button. */
async function openCalendar() {
  await userEvent
    .setup()
    .click(await screen.findByRole("button", { name: "Manage Google Calendar" }));
  await screen.findByRole("heading", { name: "Google Calendar" });
}

describe("SchedulePage Google Calendar (US-STU-005)", () => {
  it("AC-STU-005.1: starts consent with the current term and the authenticated API", async () => {
    const consent =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      new URLSearchParams({
        client_id: "test-client.apps.googleusercontent.com",
        redirect_uri: "http://localhost:3000/calendar/google/callback",
        response_type: "code",
        scope: "openid https://www.googleapis.com/auth/calendar.app.created",
        state: "PRIVATE-CONSENT-STATE",
        nonce: "PRIVATE-CONSENT-NONCE",
        code_challenge: "PRIVATE-PKCE-CHALLENGE",
        code_challenge_method: "S256",
        access_type: "offline",
        prompt: "consent select_account",
      }).toString();
    const api = mockCalendarApi({
      [AUTHORIZE_ROUTE]: { status: 200, body: { authorization_url: consent, expires_in: 600 } },
    });
    const navigate = vi.spyOn(calendarNavigation, "authorize").mockImplementation(() => {});
    renderCalendarApp();
    const user = userEvent.setup();
    const connect = await screen.findByRole("button", {
      name: "Connect to Google Calendar to sync your class schedule",
    });
    await waitFor(() => expect(connect).toBeEnabled());
    await user.click(connect);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(consent));
    const authorization = new URL(navigate.mock.calls[0]![0]);
    expect(authorization.searchParams.get("prompt")).toBe("consent select_account");
    expect(authorization.searchParams.get("code_challenge")).toBe("PRIVATE-PKCE-CHALLENGE");
    expect(authorization.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/calendar/google/callback",
    );
    expect(api.called(SYNC_ROUTE)).toHaveLength(0);
    expect(api.called(AUTHORIZE_ROUTE)).toEqual([
      expect.objectContaining({
        body: { year: "2026-2027", semester: "first" },
        authorization: "Bearer access-1",
      }),
    ]);
    expect(document.body).not.toHaveTextContent("PRIVATE-CONSENT-STATE");
  });

  it("AC-STU-005.9: shows Connected, Last sync, Next sync and the terms, without Google identifiers", async () => {
    mockCalendarApi({
      [CALENDAR_ROUTE]: {
        status: 200,
        body: {
          ...connectedCalendar,
          google_id: "PRIVATE-GOOGLE-ID",
          refresh_token: "PRIVATE-GOOGLE-TOKEN",
        },
      },
    });
    renderCalendarApp();
    await openCalendar();
    await screen.findByText("Connected", { exact: true });
    expect(within(calendar()).getByText("Last sync")).toBeInTheDocument();
    expect(within(calendar()).getByText("Next sync")).toBeInTheDocument();
    expect(calendar().querySelector('time[datetime="2026-11-10T01:30:00Z"]')).not.toBeNull();
    expect(
      within(calendar()).getByRole("checkbox", { name: "2026-2027 · First Semester" }),
    ).toBeChecked();
    expect(screen.getByRole("button", { name: "Disconnect Google Calendar" })).toBeEnabled();
    expect(document.body.textContent).not.toMatch(/PRIVATE-GOOGLE/);
  });

  it("AC-STU-005.9: the connected view is concise: no manual term form, jargon or helper paragraphs", async () => {
    mockCalendarApi({ [CALENDAR_ROUTE]: { status: 200, body: connectedCalendar } });
    renderCalendarApp();
    await openCalendar();
    await screen.findByText("Connected", { exact: true });
    expect(screen.queryByLabelText("Academic year")).toBeNull();
    expect(screen.queryByLabelText("Semester")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add term to selection" })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    const text = calendar().textContent ?? "";
    for (const gone of [
      "Linked term",
      "terms linked",
      "(Manila)",
      "Select up to 10 terms",
      "Sync runs in the background",
      "Google changes do not update",
    ])
      expect(text).not.toContain(gone);
  });

  it("AC-STU-005.4: queues each checked term, shows Sync queued, then refreshes authoritative status", async () => {
    const api = mockCalendarApi({
      [CALENDAR_ROUTE]: [
        { status: 200, body: twoTerms },
        { status: 200, body: { ...twoTerms, last_sync_at: "2026-11-11T04:00:00Z" } },
      ],
      [SYNC_ROUTE]: { status: 202, body: twoTerms },
    });
    renderCalendarApp();
    await openCalendar();
    await screen.findByText("Connected", { exact: true });
    const user = userEvent.setup();
    // The current term starts checked; the other linked term is one tick away.
    expect(screen.getByRole("checkbox", { name: "2026-2027 · First Semester" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "2025-2026 · Second Semester" })).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "2025-2026 · Second Semester" }));
    await user.click(screen.getByRole("button", { name: "Sync now" }));
    await screen.findByText("Sync queued for 2 terms");
    expect(api.called(SYNC_ROUTE).map((call) => call.body)).toEqual([
      { year: "2026-2027", semester: "first" },
      { year: "2025-2026", semester: "second" },
    ]);
    await user.click(screen.getByRole("button", { name: "Refresh Google Calendar status" }));
    await waitFor(() =>
      expect(calendar().querySelector('time[datetime="2026-11-11T04:00:00Z"]')).not.toBeNull(),
    );
  });

  it("AC-STU-005.4: a single sync says only Sync queued", async () => {
    mockCalendarApi({
      [CALENDAR_ROUTE]: { status: 200, body: connectedCalendar },
      [SYNC_ROUTE]: { status: 202, body: connectedCalendar },
    });
    renderCalendarApp();
    await openCalendar();
    await screen.findByText("Connected", { exact: true });
    await userEvent.setup().click(screen.getByRole("button", { name: "Sync now" }));
    await screen.findByText("Sync queued", { exact: true });
  });

  it("AC-STU-005.11: never allows an eleventh linked term", async () => {
    const targets = Array.from({ length: 10 }, (_, i) => ({
      year: `${2016 + i}-${2017 + i}`,
      semester: "first",
      provisioned: true,
    }));
    const api = mockCalendarApi({
      [CALENDAR_ROUTE]: { status: 200, body: { ...connectedCalendar, targets } },
      [SYNC_ROUTE]: { status: 202, body: { ...connectedCalendar, targets } },
    });
    renderCalendarApp();
    await openCalendar();
    await screen.findByText("Connected", { exact: true });
    // The current term has no room: it cannot be checked, and a sync never links an eleventh.
    const current = screen.getByRole("checkbox", { name: "2026-2027 · First Semester" });
    expect(current).toBeDisabled();
    expect(current).not.toBeChecked();
    expect(screen.getAllByRole("checkbox")).toHaveLength(11);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sync now" }));
    await waitFor(() => expect(api.called(SYNC_ROUTE)).toHaveLength(1));
    expect(api.called(SYNC_ROUTE)[0]!.body).toEqual({ year: "2016-2017", semester: "first" });
  });

  it("AC-STU-005.11: refreshes after a conflict and reports partial queues without replaying", async () => {
    const api = mockCalendarApi({
      [CALENDAR_ROUTE]: { status: 200, body: twoTerms },
      [SYNC_ROUTE]: [
        { status: 202, body: twoTerms },
        {
          status: 409,
          body: { code: "GOOGLE_CALENDAR_CONFLICT", detail: "private provider details" },
        },
      ],
    });
    renderCalendarApp();
    await openCalendar();
    await screen.findByText("Connected", { exact: true });
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name: /2025-2026/ }));
    await user.click(screen.getByRole("button", { name: "Sync now" }));
    await screen.findByText("Sync queued for 1 term. Check the sync status first.");
    await waitFor(() => expect(api.called(CALENDAR_ROUTE)).toHaveLength(2));
    expect(api.called(SYNC_ROUTE)).toHaveLength(2);
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /2026-2027/ })).not.toBeChecked(),
    );
    expect(screen.getByRole("checkbox", { name: /2025-2026/ })).toBeChecked();
    expect(document.body).not.toHaveTextContent("private provider details");
  });

  it("AC-STU-005.10: feature off disables connect but schedule and PDF/ICS downloads still work", async () => {
    const api = mockCalendarApi({
      [CALENDAR_ROUTE]: { status: 200, body: { enabled: false } },
      "GET /student/schedule/export": { status: 200, body: {} },
    });
    renderCalendarApp();
    await screen.findAllByText(GOOGLE_CALENDAR_MESSAGES.disabled);
    const user = userEvent.setup();
    // Off on the server: Connect is the only Google control, disabled, with the reason beside it.
    expect(connectButton()).toBeDisabled();
    expect(connectButton()).toHaveAccessibleDescription(GOOGLE_CALENDAR_MESSAGES.disabled);
    expect(manageButton()).toBeNull();
    expect(screen.getByText("Web Development")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Download Schedule as a PDF" }));
    await screen.findByText("Your schedule is downloading.");
    await user.click(
      screen.getByRole("button", { name: "Export class schedule as an iCalendar (.ics) file" }),
    );
    await screen.findByText(/Your schedule \(.ics\) is downloading/);
    expect(api.called("GET /student/schedule/export")).toHaveLength(2);
    expect(api.called(AUTHORIZE_ROUTE)).toHaveLength(0);
  });

  it.each([true, false])(
    "allows the opted-in frontend connection attempt when the server is off (schedule available: %s)",
    async (hasSchedule) => {
      vi.stubEnv("VITE_GOOGLE_CALENDAR_ALLOW_CONNECT_ATTEMPT", "true");
      const consent = "https://accounts.google.com/o/oauth2/v2/auth?prompt=consent+select_account";
      const api = mockCalendarApi({
        [CALENDAR_ROUTE]: { status: 200, body: { enabled: false } },
        [AUTHORIZE_ROUTE]: { status: 200, body: { authorization_url: consent } },
        ...(!hasSchedule
          ? {
              "GET /student/schedule": {
                status: 200,
                body: {
                  term: null,
                  courses: [],
                  total_credits: "0",
                  state: "notEnrolled",
                  message: null,
                },
              },
            }
          : {}),
      });
      const navigate = vi.spyOn(calendarNavigation, "authorize").mockImplementation(() => {});
      renderCalendarApp();
      await screen.findByText(GOOGLE_CALENDAR_MESSAGES.connectAttempt);
      const connect = screen.getByRole("button", { name: /Connect to Google Calendar/ });
      expect(connect).toBeEnabled();
      await userEvent.setup().click(connect);
      await waitFor(() => expect(navigate).toHaveBeenCalledWith(consent));
      expect(api.called(AUTHORIZE_ROUTE)).toHaveLength(1);
      expect(screen.queryByRole("button", { name: "Manage Google Calendar" })).toBeNull();
      expect(api.called(SYNC_ROUTE)).toHaveLength(0);
    },
  );

  it("shows a real backend rejection after the opted-in connection attempt without pretending to connect", async () => {
    vi.stubEnv("VITE_GOOGLE_CALENDAR_ALLOW_CONNECT_ATTEMPT", "true");
    const api = mockCalendarApi({
      [CALENDAR_ROUTE]: { status: 200, body: { enabled: false } },
      [AUTHORIZE_ROUTE]: { status: 503, body: { code: "GOOGLE_CALENDAR_UNAVAILABLE" } },
    });
    const navigate = vi.spyOn(calendarNavigation, "authorize").mockImplementation(() => {});
    renderCalendarApp();
    await screen.findByText(GOOGLE_CALENDAR_MESSAGES.connectAttempt);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /Connect to Google Calendar/ }));
    await screen.findByText(GOOGLE_CALENDAR_MESSAGES.unavailable);
    expect(api.called(AUTHORIZE_ROUTE)).toHaveLength(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Manage Google Calendar" })).toBeNull();
    expect(api.called(SYNC_ROUTE)).toHaveLength(0);
  });

  it("AC-STU-005.1: Connect stays active while a disconnect finishes, and re-reads the status before consent", async () => {
    const consent = "https://accounts.google.com/o/oauth2/v2/auth?prompt=consent+select_account";
    const api = mockCalendarApi({
      [CALENDAR_ROUTE]: [
        { status: 200, body: { ...calendarStatus, disconnecting: true } },
        { status: 200, body: calendarStatus },
      ],
      [AUTHORIZE_ROUTE]: { status: 200, body: { authorization_url: consent } },
    });
    const navigate = vi.spyOn(calendarNavigation, "authorize").mockImplementation(() => {});
    renderCalendarApp();
    const connect = await screen.findByRole("button", {
      name: /Connect to Google Calendar to sync/,
    });
    await waitFor(() => expect(connect).toBeEnabled());
    expectActiveConnect(connect);
    expect(manageButton()).toBeNull();
    await userEvent.setup().click(connect);
    // The pending removal had finished: status was re-read, then consent began.
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(consent));
    expect(api.called(CALENDAR_ROUTE)).toHaveLength(2);
    expect(api.called(AUTHORIZE_ROUTE)).toHaveLength(1);
  });

  it("AC-STU-005.1: while the revocation is still pending, Connect says so and starts nothing", async () => {
    const api = mockCalendarApi({
      [CALENDAR_ROUTE]: { status: 200, body: { ...calendarStatus, disconnecting: true } },
    });
    const navigate = vi.spyOn(calendarNavigation, "authorize").mockImplementation(() => {});
    renderCalendarApp();
    const connect = await screen.findByRole("button", {
      name: /Connect to Google Calendar to sync/,
    });
    await waitFor(() => expect(connect).toBeEnabled());
    await userEvent.setup().click(connect);
    await screen.findByText(GOOGLE_CALENDAR_MESSAGES.stillDisconnecting);
    expect(api.called(AUTHORIZE_ROUTE)).toHaveLength(0);
    expect(navigate).not.toHaveBeenCalled();
    expect(manageButton()).toBeNull();
  });

  it("AC-STU-005.12: shows the backend lastError and a reconnect action", async () => {
    mockCalendarApi({
      [CALENDAR_ROUTE]: {
        status: 200,
        body: { ...calendarStatus, last_error: "reconnectRequired" },
      },
    });
    renderCalendarApp();
    await screen.findByText("Last sync error: reconnectRequired");
    expect(
      screen.getByRole("button", { name: /Connect to Google Calendar to sync/ }),
    ).toBeEnabled();
    expectActiveConnect(connectButton());
    expect(manageButton()).toBeNull();
  });

  it("AC-STU-005.6, AC-STU-005.14: confirms disconnect, then shows a compact dismissible notice beside an active Connect", async () => {
    const api = mockCalendarApi({
      [CALENDAR_ROUTE]: { status: 200, body: connectedCalendar },
      [DISCONNECT_ROUTE]: {
        status: 202,
        body: { ...calendarStatus, disconnecting: true, next_sync_at: "2026-11-11T05:00:00Z" },
      },
    });
    renderCalendarApp();
    await openCalendar();
    await screen.findByText("Connected", { exact: true });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Disconnect Google Calendar" }));
    await user.click(within(disconnectDialog()).getByRole("button", { name: "Cancel" }));
    expect(api.called(DISCONNECT_ROUTE)).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Disconnect Google Calendar" }));
    await user.click(within(disconnectDialog()).getByRole("button", { name: "Disconnect" }));
    const notice = await screen.findByText("Disconnected. Your calendar stays in Google.");
    expect(api.called(DISCONNECT_ROUTE)).toHaveLength(1);
    // Nothing left to manage: the pop-up closed, Manage is gone, Connect is active and focused.
    expect(screen.queryByRole("dialog", { name: "Google Calendar" })).toBeNull();
    expect(manageButton()).toBeNull();
    await waitFor(() => expectActiveConnect(connectButton()));
    await waitFor(() => expect(connectButton()).toHaveFocus());
    // Compact notice, dismissible.
    expect(notice.closest('[role="status"]')).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Dismiss message" }));
    expect(screen.queryByText("Disconnected. Your calendar stays in Google.")).toBeNull();
  });

  it("AC-STU-005.14: clicking Connect again clears the Disconnected notice", async () => {
    const consent = "https://accounts.google.com/o/oauth2/v2/auth?prompt=consent+select_account";
    mockCalendarApi({
      [CALENDAR_ROUTE]: [
        { status: 200, body: connectedCalendar },
        { status: 200, body: calendarStatus },
      ],
      [DISCONNECT_ROUTE]: { status: 202, body: { ...calendarStatus, disconnecting: true } },
      [AUTHORIZE_ROUTE]: { status: 200, body: { authorization_url: consent } },
    });
    const navigate = vi.spyOn(calendarNavigation, "authorize").mockImplementation(() => {});
    renderCalendarApp();
    await openCalendar();
    await screen.findByText("Connected", { exact: true });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Disconnect Google Calendar" }));
    await user.click(within(disconnectDialog()).getByRole("button", { name: "Disconnect" }));
    await screen.findByText(GOOGLE_CALENDAR_MESSAGES.disconnected);
    await user.click(connectButton());
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(consent));
    expect(screen.queryByText(GOOGLE_CALENDAR_MESSAGES.disconnected)).toBeNull();
  });

  it("AC-STU-005.15: an unavailable authorization does not attach a connection", async () => {
    const api = mockCalendarApi({
      [AUTHORIZE_ROUTE]: {
        status: 503,
        body: { code: "GOOGLE_CALENDAR_UNAVAILABLE", detail: "PRIVATE-GOOGLE-TOKEN" },
      },
    });
    const navigate = vi.spyOn(calendarNavigation, "authorize").mockImplementation(() => {});
    renderCalendarApp();
    const user = userEvent.setup();
    const connect = await screen.findByRole("button", {
      name: /Connect to Google Calendar to sync/,
    });
    await waitFor(() => expect(connect).toBeEnabled());
    await user.click(connect);
    await screen.findByText(GOOGLE_CALENDAR_MESSAGES.unavailable);
    expect(screen.queryByRole("button", { name: "Manage Google Calendar" })).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(api.called(AUTHORIZE_ROUTE)).toHaveLength(1);
    expect(document.body).not.toHaveTextContent("PRIVATE-GOOGLE-TOKEN");
  });

  it("AC-STU-005.15: a 503 status read shows the unavailable message and a retry", async () => {
    const api = mockCalendarApi({
      [CALENDAR_ROUTE]: [
        { status: 503, body: { code: "GOOGLE_CALENDAR_UNAVAILABLE" } },
        { status: 200, body: connectedCalendar },
      ],
    });
    renderCalendarApp();
    await screen.findByText(GOOGLE_CALENDAR_MESSAGES.unavailable);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Retry Google Calendar status" }));
    await openCalendar();
    await screen.findByText("Connected", { exact: true });
    expect(api.called(CALENDAR_ROUTE)).toHaveLength(2);
  });

  it("AC-STU-005.9: status loading does not block the schedule", async () => {
    mockCalendarApi({ [CALENDAR_ROUTE]: "pending" });
    renderCalendarApp();
    expect(
      await screen.findByRole("button", { name: /Connect to Google Calendar to sync/ }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("region", { name: "Google Calendar" })).toBeNull();
    await screen.findByText("Web Development");
    expect(screen.getByRole("button", { name: "Download Schedule as a PDF" })).toBeEnabled();
  });

  it("AC-STU-005.6: disconnect is available even when status permission is withdrawn", async () => {
    const api = mockCalendarApi({
      [CALENDAR_ROUTE]: { status: 403, body: { code: "FORBIDDEN" } },
      [DISCONNECT_ROUTE]: { status: 202, body: calendarStatus },
    });
    renderCalendarApp();
    const user = userEvent.setup();
    await openCalendar();
    await user.click(screen.getByRole("button", { name: "Disconnect Google Calendar" }));
    await user.click(within(disconnectDialog()).getByRole("button", { name: "Disconnect" }));
    await screen.findByText(GOOGLE_CALENDAR_MESSAGES.disconnected);
    expect(api.called(DISCONNECT_ROUTE)).toHaveLength(1);
  });

  it("AC-STU-005.9: a failed initial status load is not reported as a conflict, and the schedule still works", async () => {
    const api = mockCalendarApi({
      [CALENDAR_ROUTE]: [
        { status: 500, body: { code: "INTERNAL_ERROR", detail: "PRIVATE-GOOGLE-TOKEN" } },
        { status: 200, body: connectedCalendar },
      ],
      "GET /student/schedule/export": { status: 200, body: {} },
    });
    renderCalendarApp();
    await screen.findByRole("button", { name: "Retry Google Calendar status" });
    expect(screen.getByText(GOOGLE_CALENDAR_MESSAGES.statusLoadFailed)).toBeVisible();
    expect(document.body).not.toHaveTextContent(/could not be confirmed/);
    expect(document.body).not.toHaveTextContent(GOOGLE_CALENDAR_MESSAGES.conflict);
    expect(document.body).not.toHaveTextContent("PRIVATE-GOOGLE-TOKEN");
    expect(screen.getByText("Web Development")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Download Schedule as a PDF" }));
    await screen.findByText("Your schedule is downloading.");
    await user.click(screen.getByRole("button", { name: "Retry Google Calendar status" }));
    await openCalendar();
    await screen.findByText("Connected", { exact: true });
    expect(api.called(CALENDAR_ROUTE)).toHaveLength(2);
    expect(screen.queryByText(GOOGLE_CALENDAR_MESSAGES.statusLoadFailed)).toBeNull();
  });

  it("AC-STU-005.2: an expired authorization state asks the student to connect again", async () => {
    const api = mockCalendarApi({
      [AUTHORIZE_ROUTE]: { status: 400, body: { code: "GOOGLE_CALENDAR_INVALID_STATE" } },
    });
    const navigate = vi.spyOn(calendarNavigation, "authorize").mockImplementation(() => {});
    renderCalendarApp();
    const connect = await screen.findByRole("button", {
      name: /Connect to Google Calendar to sync/,
    });
    await waitFor(() => expect(connect).toBeEnabled());
    await userEvent.setup().click(connect);
    await screen.findByText("That Google sign-in expired. Please connect again.");
    expect(navigate).not.toHaveBeenCalled();
    expect(api.called(AUTHORIZE_ROUTE)).toHaveLength(1);
  });

  it("AC-STU-005.11: a 409 on sync says to check the status first and reloads it", async () => {
    const api = mockCalendarApi({
      [CALENDAR_ROUTE]: { status: 200, body: connectedCalendar },
      [SYNC_ROUTE]: { status: 409, body: { code: "GOOGLE_CALENDAR_CONFLICT" } },
    });
    renderCalendarApp();
    await openCalendar();
    await screen.findByText("Connected", { exact: true });
    await userEvent.setup().click(screen.getByRole("button", { name: "Sync now" }));
    await within(calendar()).findByText("Check the sync status first.");
    await waitFor(() => expect(api.called(CALENDAR_ROUTE)).toHaveLength(2));
    expect(api.called(SYNC_ROUTE)).toHaveLength(1);
    expect(document.body).not.toHaveTextContent(/could not be confirmed/);
  });

  it("AC-STU-005.10: with the server flag off, the connect control stays off and downloads work", async () => {
    mockCalendarApi({ [CALENDAR_ROUTE]: { status: 200, body: { enabled: false } } });
    renderCalendarApp();
    expect(await screen.findAllByText(GOOGLE_CALENDAR_MESSAGES.disabled)).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: /Connect to Google Calendar/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download Schedule as a PDF" })).toBeEnabled();
  });

  it("AC-STU-005.1: a student who is not connected sees only the connect button, no separate card", async () => {
    mockCalendarApi();
    renderCalendarApp();
    const connect = await screen.findByRole("button", {
      name: "Connect to Google Calendar to sync your class schedule",
    });
    await waitFor(() => expect(connect).toBeEnabled());
    expectActiveConnect(connect);
    expect(manageButton()).toBeNull();
    expect(screen.queryByRole("region", { name: "Google Calendar" })).toBeNull();
    expect(screen.queryByText("Not connected", { exact: true })).toBeNull();
    expect(screen.queryByRole("button", { name: "Refresh Google Calendar status" })).toBeNull();
    expect(screen.getByRole("button", { name: "Download Schedule as a PDF" })).toHaveTextContent(
      "Download Schedule (PDF)",
    );
  });

  it("AC-STU-005.9: connected details stay off the page until Manage is pressed", async () => {
    mockCalendarApi({ [CALENDAR_ROUTE]: { status: 200, body: connectedCalendar } });
    renderCalendarApp();
    await screen.findByRole("button", { name: "Manage Google Calendar" });
    expect(screen.queryByRole("region", { name: "Google Calendar" })).toBeNull();
    expect(screen.queryByText("Terms to sync")).toBeNull();
    await openCalendar();
    expect(screen.getByText("Terms to sync")).toBeInTheDocument();
  });

  it("AC-STU-005.9: the pop-up has one × in its header, no bottom Close button, and closes with ×, Escape or the backdrop", async () => {
    mockCalendarApi({ [CALENDAR_ROUTE]: { status: 200, body: connectedCalendar } });
    renderCalendarApp();
    const user = userEvent.setup();
    const manage = await screen.findByRole("button", { name: "Manage Google Calendar" });
    const closed = () =>
      expect(screen.queryByRole("region", { name: "Google Calendar" })).toBeNull();

    await user.click(manage);
    const dialog = screen.getByRole("dialog", { name: "Google Calendar" });
    expect(dialog).toHaveAttribute("open");
    // Exactly one Close control, in the header next to the title (not another full-width button).
    const close = within(dialog).getByRole("button", { name: "Close" });
    expect(within(dialog).getAllByRole("button", { name: /close/i })).toHaveLength(1);
    expect(dialog.querySelector("h2")!.parentElement).toContainElement(close);
    expect(close).toHaveFocus();
    await user.click(close);
    closed();
    expect(manage).toHaveFocus();

    await user.click(manage);
    fireEvent(
      screen.getByRole("dialog", { name: "Google Calendar" }),
      new Event("cancel", { cancelable: true }),
    );
    await waitFor(closed);
    expect(manage).toHaveFocus();

    await user.click(manage);
    // A click on the backdrop lands on the dialog element itself; one inside it does not close.
    await user.click(screen.getByText("Terms to sync"));
    expect(screen.getByRole("dialog", { name: "Google Calendar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("dialog", { name: "Google Calendar" }));
    await waitFor(closed);
    expect(manage).toHaveFocus();
  });

  it("AC-STU-005.9: Sync now is disabled with a short note until a term is checked", async () => {
    const api = mockCalendarApi({ [CALENDAR_ROUTE]: { status: 200, body: connectedCalendar } });
    renderCalendarApp();
    await openCalendar();
    await screen.findByText("Connected", { exact: true });
    const user = userEvent.setup();
    const sync = screen.getByRole("button", { name: "Sync now" });
    const term = screen.getByRole("checkbox", { name: "2026-2027 · First Semester" });
    expect(sync).toBeEnabled();
    expect(screen.queryByText("Select at least one term")).toBeNull();
    await user.click(term);
    expect(screen.getByText("Select at least one term")).toBeInTheDocument();
    expect(sync).toBeDisabled();
    expect(sync).toHaveAccessibleDescription("Select at least one term");
    await user.click(term);
    expect(sync).toBeEnabled();
    expect(api.called(SYNC_ROUTE)).toHaveLength(0);
  });

  it("AC-STU-005.4, AC-STU-005.12: Sync queued and a last-sync error sit right under the timestamps, above the terms", async () => {
    mockCalendarApi({
      [CALENDAR_ROUTE]: {
        status: 200,
        body: { ...connectedCalendar, last_error: "providerUnavailable" },
      },
      [SYNC_ROUTE]: {
        status: 202,
        body: { ...connectedCalendar, last_error: "providerUnavailable" },
      },
    });
    renderCalendarApp();
    await openCalendar();
    await screen.findByText("Connected", { exact: true });
    const times = within(calendar()).getByText("Next sync").closest("dl")!;
    const terms = within(calendar()).getByRole("group", { name: "Terms to sync" });
    const after = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    const failure = within(calendar()).getByText("Last sync error: providerUnavailable");
    expect(after(times, failure) && after(failure, terms)).toBe(true);
    await userEvent.setup().click(screen.getByRole("button", { name: "Sync now" }));
    const queued = await screen.findByText("Sync queued", { exact: true });
    expect(after(times, queued) && after(queued, terms)).toBe(true);
    // Nothing needs scrolling to find them: they come before the checklist and the buttons.
    expect(after(queued, screen.getByRole("button", { name: "Sync now" }))).toBe(true);
  });

  it("AC-STU-005.12: a failed sync is visible on the page without opening the pop-up", async () => {
    mockCalendarApi({
      [CALENDAR_ROUTE]: {
        status: 200,
        body: { ...connectedCalendar, last_error: "providerUnavailable" },
      },
    });
    renderCalendarApp();
    await screen.findByText("Last sync error: providerUnavailable");
    expect(screen.queryByRole("region", { name: "Google Calendar" })).toBeNull();
    await openCalendar();
    // Shown once: the pop-up carries it while open.
    expect(screen.getAllByText("Last sync error: providerUnavailable")).toHaveLength(1);
  });

  it("AC-STU-005.9: shows Sync now and Disconnect for a connected student", async () => {
    mockCalendarApi({ [CALENDAR_ROUTE]: { status: 200, body: connectedCalendar } });
    renderCalendarApp();
    await openCalendar();
    await screen.findByText("Connected", { exact: true });
    expect(screen.getByRole("button", { name: "Sync now" })).toBeEnabled();
    // A pop-up, not a card on the page.
    expect(calendar().closest("dialog")).not.toBeNull();
    expect(
      within(calendar()).getByRole("button", { name: "Disconnect Google Calendar" }),
    ).toHaveTextContent(/^Disconnect$/);
    expect(within(calendar()).getByRole("group", { name: "Terms to sync" })).toBeInTheDocument();
  });

  it("AC-STU-005.4: sync can be started with the keyboard alone", async () => {
    const api = mockCalendarApi({
      [CALENDAR_ROUTE]: { status: 200, body: connectedCalendar },
      [SYNC_ROUTE]: { status: 202, body: connectedCalendar },
    });
    renderCalendarApp();
    await openCalendar();
    await screen.findByText("Connected", { exact: true });
    const user = userEvent.setup();
    screen.getByRole("button", { name: "Sync now" }).focus();
    await user.keyboard("{Enter}");
    await screen.findByText("Sync queued", { exact: true });
    expect(api.called(SYNC_ROUTE)).toHaveLength(1);
  });

  it("AC-STU-005.9: the connected calendar passes axe and keeps every control at a 320px viewport", async () => {
    const original = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });
    try {
      window.dispatchEvent(new Event("resize"));
      mockCalendarApi({ [CALENDAR_ROUTE]: { status: 200, body: connectedCalendar } });
      const { container } = renderCalendarApp();
      await openCalendar();
      await screen.findByText("Connected", { exact: true });
      await expectNoA11yViolations(container);
      for (const name of [
        "Sync now",
        "Disconnect Google Calendar",
        "Refresh Google Calendar status",
      ])
        expect(screen.getByRole("button", { name })).toBeVisible();
      // jsdom has no layout engine: pin the single-column, shrinkable structure instead.
      const region = calendar();
      expect(region.closest("dialog")?.className).toMatch(/w-\[calc\(100%-2rem\)\]/);
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: original });
    }
  });

  it("AC-STU-005.9, AC-STU-005.14: supports keyboard decisions and passes axe", async () => {
    mockCalendarApi({ [CALENDAR_ROUTE]: { status: 200, body: twoTerms } });
    const { container } = renderCalendarApp();
    const user = userEvent.setup();
    const manage = await screen.findByRole("button", { name: "Manage Google Calendar" });
    manage.focus();
    await user.keyboard("{Enter}");
    await screen.findByText("Connected", { exact: true });
    await expectNoA11yViolations(container);
    // Keyboard order inside the pop-up: close, refresh, terms, Sync now, Disconnect.
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Refresh Google Calendar status" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("checkbox", { name: /2026-2027/ })).toHaveFocus();
    await user.keyboard(" ");
    expect(screen.getByRole("checkbox", { name: /2026-2027/ })).not.toBeChecked();
    await user.keyboard(" ");
    await user.tab();
    await user.keyboard(" ");
    expect(screen.getByRole("checkbox", { name: /2025-2026/ })).toBeChecked();
    await user.tab();
    expect(screen.getByRole("button", { name: "Sync now" })).toHaveFocus();
    await user.tab();
    const disconnect = screen.getByRole("button", { name: "Disconnect Google Calendar" });
    expect(disconnect).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(within(disconnectDialog()).getByRole("button", { name: "Cancel" })).toHaveFocus();
    await expectNoA11yViolations(disconnectDialog());
    // Escape closes the confirmation first, then the pop-up, and focus returns to Manage.
    fireEvent(disconnectDialog(), new Event("cancel", { cancelable: true }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Disconnect Google Calendar?" })).toBeNull(),
    );
    fireEvent(
      screen.getByRole("dialog", { name: "Google Calendar" }),
      new Event("cancel", { cancelable: true }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Google Calendar" })).toBeNull(),
    );
    expect(manage).toHaveFocus();
  });
});
