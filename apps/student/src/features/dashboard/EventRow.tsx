import { useState } from "react";

import { formatEventDates } from "../../lib/datetime";
import type { CalendarEvent } from "./types";

function InfoCircleIcon() {
  return (
    <svg
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

interface EventRowProps {
  event: CalendarEvent;
  /** Keeps the details' ids unique when the same event is on the page twice (card and calendar). */
  scope: string;
}

export function EventRow({ event, scope }: EventRowProps) {
  const [open, setOpen] = useState(false);
  const detailsId = `event-details-${scope}-${event.id}`;
  return (
    <li className="hover:bg-brand-cream/60 rounded-lg px-1 py-1.5 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-brand-ink text-xs font-semibold break-words">
            <time dateTime={event.startsOn}>{formatEventDates(event.startsOn, event.endsOn)}</time>
          </p>
          <p className="text-brand-muted text-xs break-words">{event.title}</p>
        </div>
        <button
          type="button"
          className="text-brand-muted hover:bg-brand-maroon/10 hover:text-brand-maroon grid size-11 shrink-0 cursor-pointer place-items-center rounded-full transition-colors"
          aria-label={`More about ${event.title}`}
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen(!open)}
        >
          <InfoCircleIcon />
        </button>
      </div>
      {open && (
        <div
          id={detailsId}
          className="border-brand-border/40 text-brand-help mt-1 mb-1 rounded-lg border bg-white px-3 py-2 text-xs leading-relaxed break-words"
        >
          <p className="text-brand-ink font-semibold">{event.title}</p>
          <p>
            {event.endsOn ? "Runs " : "On "}
            {formatEventDates(event.startsOn, event.endsOn)}
          </p>
          <p className="mt-1">
            {event.details ?? "No further details were posted for this event."}
          </p>
        </div>
      )}
    </li>
  );
}
