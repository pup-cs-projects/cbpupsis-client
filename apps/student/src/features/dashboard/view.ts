// The dashboard's small rules about what to show, apart from the components that show it.

import type { ActivityItem, CalendarEvent } from "./types";

/** How far back the full activity log reaches. */
export const ACTIVITY_WINDOW_DAYS = 90;

/** How many events and activity items the dashboard cards show before "see all". */
export const CARD_LIMIT = 3;

/** The last day an event covers: its end for a multi-day event, otherwise its one day. */
export function lastDay(event: CalendarEvent) {
  return event.endsOn ?? event.startsOn;
}

/** Soonest first; events starting the same day by the day they end. */
export function byStart(a: CalendarEvent, b: CalendarEvent) {
  return a.startsOn.localeCompare(b.startsOn) || lastDay(a).localeCompare(lastDay(b));
}

/** Events still to come, or under way, on `today`: those that have not ended before it. */
export function upcomingEvents(events: CalendarEvent[], today: string) {
  return events.filter((event) => lastDay(event) >= today).sort(byStart);
}

/** Newest first, whatever order the API sent. */
export function newestFirst(items: ActivityItem[]) {
  return [...items].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

/** "₱1,500.00". An unknown currency code falls back to PHP rather than failing the page. */
export function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(amount);
  } catch {
    return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
  }
}

function ordinal(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** "ENROLLED" → "Enrolled"; "ON_LEAVE" → "On leave". */
function statusWords(status: string) {
  const text = status
    .replace(/[_\s]+/g, " ")
    .trim()
    .toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * "BSCS · 3rd year · Enrolled": the line under the student's name (AC-STU-001.1). A detail the
 * University has not recorded reads as words, never as a blank, "null" or "undefined".
 */
export function studentDetails(student: {
  programme: string | null;
  yearLevel: number | null;
  enrollmentStatus: string | null;
}) {
  const programme = student.programme?.trim() || "Program unavailable";
  const year =
    student.yearLevel !== null && student.yearLevel >= 1
      ? `${ordinal(student.yearLevel)} year`
      : "Year level unavailable";
  const status = student.enrollmentStatus?.trim();
  const enrollment =
    !status || /^not[_\s]enrolled$/i.test(status) ? "Not enrolled this term" : statusWords(status);
  return [programme, year, enrollment].join(" · ");
}
