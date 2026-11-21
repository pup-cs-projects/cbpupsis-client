import { ApiError } from "@cbpupsis/shared/api";
import type { GoogleCalendarCallback, ScheduleTerm } from "@cbpupsis/shared/schedule";

import { scheduleApi, session } from "../../lib/auth";

export const GOOGLE_CALENDAR_MESSAGES = {
  invalidState: "That Google sign-in expired. Please connect again.",
  unavailable: "Google Calendar is not available right now. Please try again.",
  conflict: "Check the sync status first.",
  stillDisconnecting: "Disconnect is still finishing. Try again in a moment.",
  disconnected: "Disconnected. Your calendar stays in Google.",
  disabled: "Google Calendar sync is turned off.",
  statusLoadFailed:
    "We couldn't load your Google Calendar status. Your schedule and downloads still work.",
  connectAttempt:
    "Google Calendar is not available on the server yet. You can try connecting or export an .ics file.",
};

export const googleCalendarKeys = {
  all: ["google-calendar"] as const,
  status: (userId: string) => ["google-calendar", userId] as const,
};

export const googleCalendarApi = {
  status: (signal?: AbortSignal) =>
    session.authorized((token) => scheduleApi.googleCalendar.status(token, signal)),
  authorize: (term?: ScheduleTerm) =>
    session.authorized((token) => scheduleApi.googleCalendar.authorize(token, term)),
  callback: (payload: GoogleCalendarCallback) =>
    session.authorized((token) => scheduleApi.googleCalendar.callback(token, payload)),
  sync: (term: ScheduleTerm) =>
    session.authorized((token) => scheduleApi.googleCalendar.sync(token, term)),
  disconnect: () => session.authorized((token) => scheduleApi.googleCalendar.disconnect(token)),
};

/** Only the API parser's validated Google consent URL reaches this boundary. */
export const calendarNavigation = { authorize: (url: string) => window.location.assign(url) };

export function googleCalendarError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "GOOGLE_CALENDAR_INVALID_STATE")
      return GOOGLE_CALENDAR_MESSAGES.invalidState;
    if (error.code === "GOOGLE_CALENDAR_UNAVAILABLE" || error.status === 503)
      return GOOGLE_CALENDAR_MESSAGES.unavailable;
    if (error.code === "GOOGLE_CALENDAR_CONFLICT") return GOOGLE_CALENDAR_MESSAGES.conflict;
    if (error.status === 401) return "Your student session has ended. Sign in, then connect again.";
    if (error.status === 403) return "Google Calendar sync is not available to your account.";
    if (error.status === 400 || error.status === 422)
      return "Check the academic year and semester, then try again. Only terms with a schedule can be synced.";
  }
  // Never echo provider payloads or callback URLs into an error message.
  return "The Google Calendar request could not be confirmed. Refresh the sync status before trying again.";
}

/**
 * The initial status read (GET) failing is not an uncertain write: say the status could not be
 * loaded, never the "could not be confirmed" wording meant for actions.
 */
export function googleCalendarStatusError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "GOOGLE_CALENDAR_UNAVAILABLE" || error.status === 503)
      return GOOGLE_CALENDAR_MESSAGES.unavailable;
    if (error.code === "GOOGLE_CALENDAR_CONFLICT") return GOOGLE_CALENDAR_MESSAGES.conflict;
    if (error.status === 401) return "Your student session has ended. Sign in, then try again.";
    if (error.status === 403) return "Google Calendar sync is not available to your account.";
  }
  return GOOGLE_CALENDAR_MESSAGES.statusLoadFailed;
}

export function termKey(term: ScheduleTerm): string {
  return JSON.stringify([term.year, term.semester]);
}
export function termLabel(term: ScheduleTerm): string {
  const names: Record<string, string> = {
    first: "First Semester",
    second: "Second Semester",
    summer: "Summer Term",
  };
  return `${term.year} · ${names[term.semester] ?? term.semester}`;
}

/** URLSearchParams decodes once; a '+' encoded as %2B must not be decoded again. */
export function readGoogleCallback(search: string): {
  payload: GoogleCalendarCallback | null;
  message: string | null;
} {
  const params = new URLSearchParams(search);
  if (params.has("error"))
    return { payload: null, message: "Google Calendar was not connected. Please connect again." };
  const state = params.get("state");
  const code = params.get("code");
  if (
    params.getAll("state").length !== 1 ||
    params.getAll("code").length !== 1 ||
    !state ||
    state.length < 32 ||
    state.length > 128 ||
    !code ||
    code.length > 2048
  )
    return { payload: null, message: GOOGLE_CALENDAR_MESSAGES.invalidState };
  return { payload: { state, code }, message: null };
}
