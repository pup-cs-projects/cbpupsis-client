import { NOTICES } from "@cbpupsis/shared/auth";
import { ErrorAlert, Notice } from "@cbpupsis/ui";
import { useSearch } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import "@cbpupsis/account/styles.css";
import { todayInManila } from "../../lib/datetime";
import { useMe } from "../sign-in/queries";
import { ActivityList, ActivityModal } from "./ActivityLog";
import { BullhornIcon } from "./BullhornIcon";
import { CalendarModal } from "./CalendarModal";
import { DashboardLayout } from "./DashboardLayout";
import { EventRow } from "./EventRow";
import { HoldBanners } from "./HoldBanners";
import { useDashboard } from "./queries";
import { CARD_LIMIT, newestFirst, studentDetails, upcomingEvents } from "./view";

// Campus photos served from apps/student/public/assets/gallery/
const GALLERY_PHOTOS = [
  { id: 1, src: "/assets/gallery/pup-main.webp", alt: "PUP Main Building" },
  { id: 2, src: "/assets/gallery/pup-obelisk.webp", alt: "PUP Obelisk" },
  { id: 3, src: "/assets/gallery/pup-pylon.webp", alt: "PUP Pylons" },
  { id: 4, src: "/assets/gallery/pup-gate.webp", alt: "PUP Gate" },
  { id: 5, src: "/assets/gallery/pup-student.webp", alt: "Campus Life" },
] as const;

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

const SEE_ALL_BUTTON =
  "border-brand-border/60 text-brand-ink hover:bg-brand-cream/60 min-h-11 w-full rounded-lg border bg-white py-2 text-sm font-medium print:hidden";

// ---- Page component ----

export function HomePage() {
  const { notice } = useSearch({ strict: false });
  const me = useMe();
  // One request for the whole page (GET /student/dashboard); every section reads from it.
  const dashboard = useDashboard();
  const data = dashboard.data;
  const fullName = data?.fullName;
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  // Today in Manila, read on each render. The cards show only events that have not ended before
  // it, and only the first three of those or of the newest activity.
  const today = todayInManila();
  const upcoming = data ? upcomingEvents(data.events, today) : [];
  const recentActivity = data ? newestFirst(data.recentActivity) : [];

  return (
    <DashboardLayout>
      {notice === "password-changed" && <Notice tone="success">{NOTICES.passwordChanged}</Notice>}
      {me.isError && <ErrorAlert error={me.error} onRetry={() => void me.refetch()} />}
      {dashboard.isError && (
        <ErrorAlert error={dashboard.error} onRetry={() => void dashboard.refetch()} />
      )}

      {/* ---- Holds: the first thing on the page. A failed load is never read as "no holds". ---- */}
      {(data || dashboard.isError) && (
        <HoldBanners holds={data ? data.holds : null} onRetry={() => void dashboard.refetch()} />
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
            className="text-brand-ink mt-1.5 text-3xl leading-tight font-bold tracking-tight break-words sm:text-4xl"
          >
            {fullName ? (
              <>
                Welcome back, <span className="text-brand-maroon">{fullName}!</span>
              </>
            ) : (
              "Welcome back!"
            )}
          </h1>
          {data && (
            <p className="text-brand-ink mt-2 text-sm font-medium break-words">
              {studentDetails(data)}
            </p>
          )}
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

        {/* ---- Two-column lower grid (minmax(0, …): a long word can never widen a column) ---- */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)]">
          {/* ---- Left: Announcements ---- */}
          <section aria-labelledby="announcements-heading" className="min-w-0 space-y-3">
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
                      className="text-brand-ink text-sm font-semibold break-words"
                    >
                      {item.title}
                    </h3>
                    <p className="text-brand-muted mt-1 text-[13px] leading-relaxed break-words">
                      {item.body}
                    </p>
                  </article>
                ))
              ))}
          </section>

          {/* ---- Right: Events + Recent Activity ---- */}
          <div className="min-w-0 space-y-6">
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
                (upcoming.length === 0 ? (
                  <p className="text-brand-muted px-1 text-sm">{data.emptyMessages.events}</p>
                ) : (
                  <ul className="space-y-0.5">
                    {upcoming.slice(0, CARD_LIMIT).map((event) => (
                      <EventRow key={event.id} event={event} scope="card" />
                    ))}
                  </ul>
                ))}

              {/* Past events stay one tap away, in the full calendar. */}
              {data && data.events.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCalendarOpen(true)}
                  className={SEE_ALL_BUTTON}
                >
                  Full Academic Calendar
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
                (recentActivity.length === 0 ? (
                  <p className="text-brand-muted text-sm">{data.emptyMessages.recentActivity}</p>
                ) : (
                  <div className="space-y-4">
                    <ActivityList items={recentActivity.slice(0, CARD_LIMIT)} />
                    <button
                      type="button"
                      onClick={() => setActivityOpen(true)}
                      className={SEE_ALL_BUTTON}
                    >
                      View all activity
                    </button>
                  </div>
                ))}
            </section>
          </div>
        </div>
      </div>

      {calendarOpen && data && (
        <CalendarModal events={data.events} today={today} onClose={() => setCalendarOpen(false)} />
      )}
      {activityOpen && data && (
        <ActivityModal items={data.recentActivity} onClose={() => setActivityOpen(false)} />
      )}
    </DashboardLayout>
  );
}
