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
        {event.details ? (
          <button
            type="button"
            className="text-brand-muted hover:text-brand-maroon grid size-11 shrink-0 place-items-center rounded-full"
            aria-label={`More about ${event.title}`}
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen(!open)}
          >
            <InfoCircleIcon />
          </button>
        ) : (
          <span className="text-brand-muted grid size-11 shrink-0 place-items-center">
            <InfoCircleIcon />
          </span>
        )}
      </div>
      {event.details && open && (
        <p id={detailsId} className="text-brand-help mt-1 pb-1 text-xs leading-relaxed break-words">
          {event.details}
        </p>
      )}
    </li>
  );
}
