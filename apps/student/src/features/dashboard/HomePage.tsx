import { NOTICES } from "@cbpupsis/shared/auth";
import { ErrorAlert, Notice } from "@cbpupsis/ui";
import { useSearch } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import "@cbpupsis/account/styles.css";
import { formatEventDates, formatTimestamp } from "../../lib/datetime";
import { useMe } from "../sign-in/queries";
import { BullhornIcon } from "./BullhornIcon";
import { DashboardLayout } from "./DashboardLayout";
import { useDashboard } from "./queries";
import type { ActivityStatus, CalendarEvent } from "./types";

// Campus photos served from apps/student/public/assets/gallery/
const GALLERY_PHOTOS = [
  { id: 1, src: "/assets/gallery/pup-main.webp", alt: "PUP Main Building" },
  { id: 2, src: "/assets/gallery/pup-obelisk.webp", alt: "PUP Obelisk" },
  { id: 3, src: "/assets/gallery/pup-pylon.webp", alt: "PUP Pylons" },
  { id: 4, src: "/assets/gallery/pup-gate.webp", alt: "PUP Gate" },
  { id: 5, src: "/assets/gallery/pup-student.webp", alt: "Campus Life" },
] as const;

// The bar's color is never alone: each item also carries its status in words. Only a warning
// (a failed sign-in, say) shows its word on screen; the others are routine.
const STATUS: Record<ActivityStatus, { word: string; bar: string; visible: boolean }> = {
  success: { word: "Completed", bar: "bg-brand-success", visible: false },
  info: { word: "Update", bar: "bg-brand-gold", visible: false },
  warning: { word: "Needs attention", bar: "bg-brand-maroon", visible: true },
};

// ---- Icons (decorative) ----

function SvgIcon({ children, className = "size-5" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={`${className} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}
const CalendarIcon = () => (
  <SvgIcon>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </SvgIcon>
);
const ClockIcon = () => (
  <SvgIcon>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </SvgIcon>
);
const InfoCircleIcon = () => (
  <SvgIcon className="size-4">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </SvgIcon>
);

/** A section's loading state: a quiet placeholder, and words for screen readers. */
function Loading({ label }: { label: string }) {
  return (
    <div>
      <p role="status" className="sr-only">
        {label}
      </p>
      <div
        aria-hidden="true"
        className="bg-brand-skeleton/25 h-16 animate-pulse rounded-xl motion-reduce:animate-none"
      />
    </div>
  );
}

// ---- Page component ----

export function HomePage() {
  const { notice } = useSearch({ strict: false });
  const me = useMe();
  // One request for the whole page (GET /student/me/dashboard); every section reads from it.
  const dashboard = useDashboard();
  const data = dashboard.data;
  const fullName = data?.fullName;

  return (
    <DashboardLayout>
      {notice === "password-changed" && <Notice tone="success">{NOTICES.passwordChanged}</Notice>}
      {me.isError && <ErrorAlert error={me.error} onRetry={() => void me.refetch()} />}
      {dashboard.isError && (
        <ErrorAlert error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      )}

      <div className="space-y-7 px-4 py-8 sm:px-8">
        {/* ---- Welcome Banner ---- */}
        <section aria-labelledby="welcome-heading">
          {data?.term && (
            <p className="text-brand-muted text-xs font-semibold tracking-widest uppercase">
              Academic Year {data.term.academicYear}
            </p>
          )}
          <h1
            id="welcome-heading"
            className="text-brand-ink mt-1.5 text-3xl leading-tight font-bold tracking-tight sm:text-4xl"
          >
            {fullName ? (
              <>
                Welcome back, <span className="text-brand-maroon">{fullName}!</span>
              </>
            ) : (
              "Welcome back!"
            )}
          </h1>
          {data?.term && (
            <p className="text-brand-muted mt-2 text-sm">
              Currently viewing{" "}
              <span className="text-brand-ink font-semibold">{data.term.termName}</span> data.
            </p>
          )}
        </section>

        {/* ---- Campus Photo Gallery ---- */}
        <section aria-label="Campus photo gallery" className="print:hidden">
          <ul className="grid grid-cols-2 gap-3 sm:flex">
            {GALLERY_PHOTOS.map((photo, index) => (
              <li
                key={photo.id}
                className={`overflow-hidden rounded-2xl shadow-sm sm:flex-1 ${
                  index === GALLERY_PHOTOS.length - 1 ? "col-span-2" : ""
                }`}
              >
                <img
                  src={photo.src}
                  alt={photo.alt}
                  className="h-40 w-full object-cover transition-transform duration-300 hover:scale-105 motion-reduce:transition-none"
                  loading="lazy"
                />
              </li>
            ))}
          </ul>
        </section>

        {/* ---- Two-column lower grid ---- */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[62fr_38fr]">
          {/* ---- Left: Announcements ---- */}
          <section aria-labelledby="announcements-heading" className="space-y-3">
            <h2
              id="announcements-heading"
              className="text-brand-maroon flex items-center gap-2 text-base font-bold"
            >
              <BullhornIcon />
              Announcements
            </h2>

            {dashboard.isPending && <Loading label="Loading announcements" />}
            {data &&
              (data.announcements.length === 0 ? (
                <div className="border-brand-border/25 text-brand-muted rounded-xl border bg-white px-5 py-6 text-sm">
                  {data.emptyMessages.announcements}
                </div>
              ) : (
                data.announcements.map((item) => (
                  <article
                    key={item.id}
                    aria-labelledby={`announcement-${item.id}`}
                    className="border-brand-border/25 rounded-xl border bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md print:break-inside-avoid print:shadow-none"
                  >
                    <h3
                      id={`announcement-${item.id}`}
                      className="text-brand-ink text-sm font-semibold"
                    >
                      {item.title}
                    </h3>
                    <p className="text-brand-muted mt-1 text-[13px] leading-relaxed">{item.body}</p>
                  </article>
                ))
              ))}
          </section>

          {/* ---- Right: Events + Recent Activity ---- */}
          <div className="space-y-6">
            {/* Events */}
            <section aria-labelledby="events-heading" className="space-y-3">
              <h2
                id="events-heading"
                className="text-brand-maroon flex items-center gap-2 text-base font-bold"
              >
                <CalendarIcon />
                Events
              </h2>

              {dashboard.isPending && <Loading label="Loading events" />}
              {data &&
                (data.events.length === 0 ? (
                  <p className="text-brand-muted px-1 text-sm">{data.emptyMessages.events}</p>
                ) : (
                  <ul className="space-y-0.5">
                    {data.events.map((event) => (
                      <EventRow key={event.id} event={event} />
                    ))}
                  </ul>
                ))}

              {data && data.events.length > 3 && (
                // No calendar route yet: unavailable rather than a dead button.
                <button
                  type="button"
                  aria-disabled="true"
                  className="border-brand-border/60 text-brand-ink min-h-11 w-full cursor-not-allowed rounded-lg border bg-white py-2 text-sm font-medium print:hidden"
                >
                  Full Academic Calendar
                  <span className="sr-only">, coming soon</span>
                </button>
              )}
            </section>

            {/* Recent Activity */}
            <section aria-labelledby="activity-heading">
              <h2
                id="activity-heading"
                className="text-brand-maroon mb-3 flex items-center gap-2 text-base font-bold"
              >
                <ClockIcon />
                Recent Activity
              </h2>

              {dashboard.isPending && <Loading label="Loading recent activity" />}
              {data &&
                (data.recentActivity.length === 0 ? (
                  <p className="text-brand-muted text-sm">{data.emptyMessages.recentActivity}</p>
                ) : (
                  <ul className="space-y-3">
                    {data.recentActivity.map((item) => {
                      const status = STATUS[item.status];
                      return (
                        <li key={item.id} className="flex gap-3">
                          <div className="mt-1 shrink-0" aria-hidden="true">
                            <div className={`h-8 w-1 rounded-full ${status.bar}`} />
                          </div>
                          <div>
                            <p className="text-brand-muted text-xs font-medium">
                              <span className={status.visible ? "" : "sr-only"}>
                                {status.word}:{" "}
                              </span>
                              <time dateTime={item.occurredAt}>
                                {formatTimestamp(item.occurredAt)}
                              </time>
                            </p>
                            <p className="text-brand-ink mt-0.5 text-[13px]">{item.description}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ))}
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  const [open, setOpen] = useState(false);
  const detailsId = `event-details-${event.id}`;
  return (
    <li className="hover:bg-brand-cream/60 rounded-lg px-1 py-1.5 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-brand-ink text-xs font-semibold">
            <time dateTime={event.startsOn}>{formatEventDates(event.startsOn, event.endsOn)}</time>
          </p>
          <p className="text-brand-muted text-xs">{event.title}</p>
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
          <span className="text-brand-muted grid size-11 place-items-center">
            <InfoCircleIcon />
          </span>
        )}
      </div>
      {event.details && open && (
        <p id={detailsId} className="text-brand-help mt-1 pb-1 text-xs leading-relaxed">
          {event.details}
        </p>
      )}
    </li>
  );
}
