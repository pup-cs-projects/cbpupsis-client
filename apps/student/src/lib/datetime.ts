// Dates are shown in Philippine time wherever the student is (docs/CONVENTIONS.md). Format them
// here, once, so every screen agrees.

const TIME_ZONE = "Asia/Manila";

const dayInManila = new Intl.DateTimeFormat("en-PH", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
});

const timeInManila = new Intl.DateTimeFormat("en-PH", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

// A calendar date ("2026-06-29") names a day, not an instant, so it is read and shown in UTC:
// no time zone can move it to the day before.
const calendarDay = new Intl.DateTimeFormat("en-PH", {
  timeZone: "UTC",
  year: "numeric",
  month: "long",
  day: "numeric",
});
const calendarDayNoYear = new Intl.DateTimeFormat("en-PH", {
  timeZone: "UTC",
  month: "long",
  day: "numeric",
});

// Newer ICU puts a narrow no-break space before AM and PM; keep one plain space everywhere.
const tidy = (text: string) => text.replace(/\u202f/g, " ");

function fromCalendarDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

/**
 * "June 29, 2026" for one day, "June 29 - July 1, 2026" for a range within a year, and both
 * years in full across a new year.
 */
export function formatEventDates(startsOn: string, endsOn?: string | null) {
  const start = fromCalendarDate(startsOn);
  if (!endsOn || endsOn === startsOn) return calendarDay.format(start);
  const end = fromCalendarDate(endsOn);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  return `${(sameYear ? calendarDayNoYear : calendarDay).format(start)} - ${calendarDay.format(end)}`;
}

/** "June 27, 2026 • 10:42 AM", in Manila, for an instant the API sends in UTC. */
export function formatTimestamp(iso: string) {
  const date = new Date(iso);
  return `${dayInManila.format(date)} • ${tidy(timeInManila.format(date))}`;
}
