import { mockApi } from "@cbpupsis/account/testing";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
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
const calendar = () => screen.getByRole("region", { name: "Google Calendar" });

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
    await screen.findByText(/Choose or sign in to a Google account/);
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

  it("AC-STU-005.9: shows connection, sync times and linked terms without Google identifiers", async () => {
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
    await screen.findByText("Connected", {});
    expect(within(calendar()).getByText("Last successful sync (Manila)")).toBeInTheDocument();
    expect(within(calendar()).getByText("Next sync attempt (Manila)")).toBeInTheDocument();
    expect(within(calendar()).getByText("2026-2027 · First Semester")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disconnect Google Calendar" })).toBeEnabled();
    expect(document.body.textContent).not.toMatch(/PRIVATE-GOOGLE/);
  });

  it("AC-STU-005.4: queues selected terms individually, then refreshes authoritative status", async () => {
    const api = mockCalendarApi({
      [CALENDAR_ROUTE]: [
        { status: 200, body: connectedCalendar },
        { status: 200, body: { ...connectedCalendar, last_sync_at: "2026-11-11T04:00:00Z" } },
      ],
      [SYNC_ROUTE]: { status: 202, body: connectedCalendar },
    });
    renderCalendarApp();
    await screen.findByText("Connected", {});
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Academic year"));
    await user.type(screen.getByLabelText("Academic year"), "2027-2028");
    await user.selectOptions(screen.getByLabelText("Semester", {}), "second");
    await user.click(screen.getByRole("button", { name: "Add term to selection" }));
    await user.click(screen.getByRole("button", { name: "Sync selected terms" }));
    await screen.findByText("Sync queued for 2 terms. Refresh status to check progress.");
    expect(api.called(SYNC_ROUTE).map((call) => call.body)).toEqual([
      { year: "2026-2027", semester: "first" },
      { year: "2027-2028", semester: "second" },
    ]);
    await user.click(screen.getByRole("button", { name: "Refresh Google Calendar status" }));
    await waitFor(() =>
      expect(calendar().querySelector('time[datetime="2026-11-11T04:00:00Z"]')).not.toBeNull(),
    );
  });

  it("AC-STU-005.11: never allows an eleventh linked term", async () => {
    const targets = Array.from({ length: 10 }, (_, i) => ({
      year: `${2016 + i}-${2017 + i}`,
      semester: "first",
      provisioned: true,
    }));
    const api = mockCalendarApi({
      [CALENDAR_ROUTE]: { status: 200, body: { ...connectedCalendar, targets } },
    });
    renderCalendarApp();
    await screen.findByText("Connected", {});
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Academic year"));
    await user.type(screen.getByLabelText("Academic year"), "2028-2029");
    await user.click(screen.getByRole("button", { name: "Add term to selection" }));
    expect(within(calendar()).getByRole("alert")).toHaveTextContent(/up to ten terms/);
    expect(api.called(SYNC_ROUTE)).toHaveLength(0);
    expect(screen.getByRole("checkbox", { name: "2026-2027 · First Semester" })).toBeDisabled();
  });

  it("AC-STU-005.11: refreshes after a conflict and reports partial queues without replaying", async () => {
    const api = mockCalendarApi({
      [CALENDAR_ROUTE]: { status: 200, body: connectedCalendar },
      [SYNC_ROUTE]: [
        { status: 202, body: connectedCalendar },
        {
          status: 409,
          body: { code: "GOOGLE_CALENDAR_CONFLICT", detail: "private provider details" },
        },
      ],
    });
    renderCalendarApp();
    await screen.findByText("Connected", {});
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Academic year"));
    await user.type(screen.getByLabelText("Academic year"), "2027-2028");
    await user.click(screen.getByRole("button", { name: "Add term to selection" }));
    await user.click(screen.getByRole("button", { name: "Sync selected terms" }));
    await screen.findByText("Sync queued for 1 term. Check the sync status first.");
    await waitFor(() => expect(api.called(CALENDAR_ROUTE)).toHaveLength(2));
    expect(api.called(SYNC_ROUTE)).toHaveLength(2);
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /2026-2027/ })).not.toBeChecked(),
    );
    expect(screen.getByRole("checkbox", { name: /2027-2028/ })).toBeChecked();
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
    expect(
      screen.getByRole("button", { name: /Connect to Google Calendar to sync/ }),
    ).toBeDisabled();
    expect(screen.getByText("Web Development")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Download Certificate of Registration (COR) as a PDF" }),
    );
    await screen.findByText("Your Certificate of Registration is downloading.");
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
      expect(screen.getByText("Not connected", { exact: true })).toBeInTheDocument();
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
    expect(screen.getByText("Not connected", { exact: true })).toBeInTheDocument();
    expect(api.called(SYNC_ROUTE)).toHaveLength(0);
  });

  it("keeps connect disabled during pending revocation even with the frontend opt-in", async () => {
    vi.stubEnv("VITE_GOOGLE_CALENDAR_ALLOW_CONNECT_ATTEMPT", "true");
    mockCalendarApi({
      [CALENDAR_ROUTE]: {
        status: 200,
        body: { ...calendarStatus, enabled: false, disconnecting: true },
      },
    });
    renderCalendarApp();
    await screen.findByText("Disconnecting", { exact: true });
    expect(screen.getByRole("button", { name: /Connect to Google Calendar/ })).toBeDisabled();
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
  });

  it("AC-STU-005.6, AC-STU-005.14: confirms disconnect and leaves calendars in Google", async () => {
    const api = mockCalendarApi({
      [CALENDAR_ROUTE]: [
        { status: 200, body: connectedCalendar },
        { status: 200, body: calendarStatus },
      ],
      [DISCONNECT_ROUTE]: {
        status: 202,
        body: { ...calendarStatus, disconnecting: true, next_sync_at: "2026-11-11T05:00:00Z" },
      },
    });
    renderCalendarApp();
    await screen.findByText("Connected", {});
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Disconnect Google Calendar" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(api.called(DISCONNECT_ROUTE)).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "Disconnect Google Calendar" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Disconnect" }),
    );
    await screen.findByText(GOOGLE_CALENDAR_MESSAGES.disconnected);
    expect(api.called(DISCONNECT_ROUTE)).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: /Connect to Google Calendar to sync/ }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Refresh Google Calendar status" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Connect to Google Calendar to sync/ }),
      ).toBeEnabled(),
    );
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
    expect(within(calendar()).getByText("Not connected", {})).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    expect(api.called(AUTHORIZE_ROUTE)).toHaveLength(1);
    expect(document.body).not.toHaveTextContent("PRIVATE-GOOGLE-TOKEN");
  });

  it("AC-STU-005.9: loading and failed status reads have clear messages and a retry", async () => {
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
    await screen.findByText("Connected", {});
    expect(api.called(CALENDAR_ROUTE)).toHaveLength(2);
  });

  it("AC-STU-005.9: status loading does not block the schedule", async () => {
    mockCalendarApi({ [CALENDAR_ROUTE]: "pending" });
    renderCalendarApp();
    await screen.findByText("Loading Google Calendar status…");
    await screen.findByText("Web Development");
    expect(
      screen.getByRole("button", { name: "Download Certificate of Registration (COR) as a PDF" }),
    ).toBeEnabled();
  });

  it("AC-STU-005.6: disconnect is available even when status permission is withdrawn", async () => {
    const api = mockCalendarApi({
      [CALENDAR_ROUTE]: { status: 403, body: { code: "FORBIDDEN" } },
      [DISCONNECT_ROUTE]: { status: 202, body: calendarStatus },
    });
    renderCalendarApp();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Disconnect Google Calendar" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Disconnect" }),
    );
    await screen.findByText(GOOGLE_CALENDAR_MESSAGES.disconnected);
    expect(api.called(DISCONNECT_ROUTE)).toHaveLength(1);
  });

  it("AC-STU-005.9, AC-STU-005.14: supports keyboard decisions and passes axe", async () => {
    mockCalendarApi({ [CALENDAR_ROUTE]: { status: 200, body: connectedCalendar } });
    const { container } = renderCalendarApp();
    await screen.findByText("Connected", {});
    await expectNoA11yViolations(container);
    const user = userEvent.setup();
    const disconnect = screen.getByRole("button", {
      name: "Disconnect Google Calendar",
    });
    disconnect.focus();
    await user.keyboard("{Enter}");
    expect(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus();
    await expectNoA11yViolations(screen.getByRole("dialog"));
  });
});
