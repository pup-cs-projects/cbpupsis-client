import { useEffect, useRef } from "react";

import { EventRow } from "./EventRow";
import { Modal } from "./Modal";
import type { CalendarEvent } from "./types";
import { byStart, lastDay } from "./view";

interface CalendarModalProps {
  events: CalendarEvent[];
  /** Today's Manila calendar date, "2026-06-29". */
  today: string;
  onClose: () => void;
}

/**
 * Every event, past and upcoming, oldest first. It opens at today's section, not at the top of
 * the past, and the past stays one scroll up.
 */
export function CalendarModal({ events, today, onClose }: CalendarModalProps) {
  const sorted = [...events].sort(byStart);
  const past = sorted.filter((event) => lastDay(event) < today);
  const upcoming = sorted.filter((event) => lastDay(event) >= today);
  const todayRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Not smooth: the calendar should simply open there. jsdom has no scrollIntoView.
    todayRef.current?.scrollIntoView?.({ block: "start" });
  }, []);

  return (
    <Modal title="Full Academic Calendar" onClose={onClose}>
      {past.length > 0 && (
        <section aria-labelledby="calendar-past-heading">
          <h3
            id="calendar-past-heading"
            className="text-brand-muted text-xs font-semibold tracking-widest uppercase"
          >
            Earlier events
          </h3>
          <ul className="mt-1 space-y-0.5">
            {past.map((event) => (
              <EventRow key={event.id} event={event} scope="calendar" />
            ))}
          </ul>
        </section>
      )}

      <section
        aria-labelledby="calendar-upcoming-heading"
        className={past.length > 0 ? "mt-4" : ""}
      >
        <h3
          ref={todayRef}
          id="calendar-upcoming-heading"
          className="text-brand-maroon scroll-mt-1 text-xs font-semibold tracking-widest uppercase"
        >
          Today and upcoming
        </h3>
        {upcoming.length === 0 ? (
          <p className="text-brand-muted mt-1 text-sm">
            No upcoming events on the academic calendar.
          </p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {upcoming.map((event) => (
              <EventRow key={event.id} event={event} scope="calendar" />
            ))}
          </ul>
        )}
      </section>
    </Modal>
  );
}
