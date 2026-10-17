import { ApiError, errorMessage } from "@cbpupsis/shared/api";
import { NOTICES } from "@cbpupsis/shared/auth";
import { AuthSkeleton } from "@cbpupsis/ui";
import { useSearch } from "@tanstack/react-router";

import "@cbpupsis/account/styles.css";
import { useMe } from "../sign-in/queries";
import BullhornIcon from "./BullhornIcon";
import { DashboardLayout } from "./DashboardLayout";
import type { ActiveTerm, ActivityItem, Announcement, AcademicEvent } from "./dashboardMocks";
// To restore mock data during UI audits, uncomment the import below and assign it to the arrays:
// import { MOCK_ANNOUNCEMENTS, MOCK_EVENTS, MOCK_RECENT_ACTIVITY, MOCK_ACTIVE_TERM } from "./dashboardMocks";
import { useDashboardUser } from "./useDashboardUser";

// Campus photos served from apps/student/public/assets/gallery/
const GALLERY_PHOTOS = [
  { id: 1, src: "/assets/gallery/pup-main.webp", alt: "PUP Main Building" },
  { id: 2, src: "/assets/gallery/pup-obelisk.webp", alt: "PUP Obelisk" },
  { id: 3, src: "/assets/gallery/pup-pylon.webp", alt: "PUP Pylons" },
  { id: 4, src: "/assets/gallery/pup-gate.webp", alt: "PUP Gate" },
  { id: 5, src: "/assets/gallery/pup-student.webp", alt: "Campus Life" },
] as const;

// Wire to an active-term API/config when available; replace with MOCK_ACTIVE_TERM for UI audits.
const activeTerm: ActiveTerm = {
  academicYear: "2026–2027",
  semester: "Second Semester",
};

// ---- Icon components ----

function CalendarIcon() {
  return (
    <svg
      className="h-5 w-5 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      className="h-5 w-5 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function InfoCircleIcon() {
  return (
    <svg
      className="h-4 w-4 flex-shrink-0 text-gray-400"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

// ---- Page component ----

export function HomePage() {
  const { notice } = useSearch({ strict: false });
  const me = useMe();
  const user = useDashboardUser();

  // Replace empty arrays with MOCK_* imports (or real API query results) to populate the UI.
  const announcements: Announcement[] = [];
  const events: AcademicEvent[] = [];
  const recentActivities: ActivityItem[] = [];

  return (
    <DashboardLayout>
      <a className="sr-only focus:not-sr-only" href="#dashboard-main">
        Skip to content
      </a>

      <div className="space-y-7 px-8 py-8">
        {/* Password-changed notice */}
        {notice === "password-changed" && (
          <p className="auth-notice" role="status">
            {NOTICES.passwordChanged}
          </p>
        )}

        {/* Signed-in identity — used by auth tests; remove once full profile is displayed */}
        {me.isSuccess && <p className="text-sm text-gray-500">Signed in as {me.data.email}</p>}

        {me.isPending && <AuthSkeleton />}
        {me.isError && (
          <div className="auth-error" role="alert">
            <p>{errorMessage(me.error)}</p>
            {me.error instanceof ApiError && me.error.requestId && (
              <p className="request-id">Reference: {me.error.requestId}</p>
            )}
            <button className="secondary-button" onClick={() => void me.refetch()}>
              Try again
            </button>
          </div>
        )}

        {/* ---- Welcome Banner ---- */}
        <section aria-labelledby="welcome-heading">
          <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
            Academic Year {activeTerm.academicYear}
          </p>
          <h1
            id="welcome-heading"
            className="mt-1.5 text-4xl leading-tight font-bold tracking-tight text-gray-900"
          >
            Welcome back, <span className="text-[#7B1113]">{user.displayName}!</span>
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Currently viewing{" "}
            <span className="font-semibold text-gray-700">{activeTerm.semester}</span> data.
          </p>
        </section>

        {/* ---- Campus Photo Gallery ---- */}
        <section aria-label="Campus photo gallery">
          <div className="flex gap-3">
            {GALLERY_PHOTOS.map((photo) => (
              <div key={photo.id} className="flex-1 overflow-hidden rounded-2xl shadow-sm">
                <img
                  src={photo.src}
                  alt={photo.alt}
                  className="h-40 w-full object-cover transition-transform duration-300 hover:scale-105"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </section>

        {/* ---- Two-column lower grid ---- */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[62fr_38fr]">
          {/* ---- Left: Announcements ---- */}
          <section aria-labelledby="announcements-heading" className="space-y-3">
            <h2
              id="announcements-heading"
              className="flex items-center gap-2 text-base font-bold text-[#7B1113]"
            >
              <BullhornIcon size={20} color="#7B1113" />
              Announcements
            </h2>

            {announcements.length === 0 ? (
              <div className="rounded-xl border border-stone-200/60 bg-white px-5 py-6 text-sm text-gray-400">
                No announcements yet.
              </div>
            ) : (
              announcements.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-stone-200/60 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <h3 className="text-sm font-semibold text-gray-800">{item.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{item.body}</p>
                </article>
              ))
            )}
          </section>

          {/* ---- Right: Events + Recent Activity ---- */}
          <div className="space-y-6">
            {/* Events */}
            <section aria-labelledby="events-heading" className="space-y-3">
              <h2
                id="events-heading"
                className="flex items-center gap-2 text-base font-bold text-[#7B1113]"
              >
                <CalendarIcon />
                Events
              </h2>

              {events.length === 0 ? (
                <p className="px-1 text-sm text-gray-400">No upcoming events scheduled.</p>
              ) : (
                <div className="space-y-0.5">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between rounded-lg px-1 py-2.5 transition-colors hover:bg-stone-100/60"
                    >
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{event.date}</p>
                        <p className="text-xs text-gray-500">{event.title}</p>
                      </div>
                      <InfoCircleIcon />
                    </div>
                  ))}
                </div>
              )}

              {events.length > 3 && (
                <button className="w-full rounded-lg border border-stone-300 bg-white py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100">
                  Full Academic Calendar
                </button>
              )}
            </section>

            {/* Recent Activity */}
            <section aria-labelledby="activity-heading">
              <h2
                id="activity-heading"
                className="mb-3 flex items-center gap-2 text-base font-bold text-[#7B1113]"
              >
                <ClockIcon />
                Recent Activity
              </h2>

              {recentActivities.length === 0 ? (
                <p className="text-sm text-gray-400">No recent activity recorded.</p>
              ) : (
                <ul className="space-y-3">
                  {recentActivities.map((item) => (
                    <li key={item.id} className="flex gap-3">
                      <div className="mt-1 flex-shrink-0">
                        <div className="h-8 w-1 rounded-full bg-emerald-500" />
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-gray-400">{item.timestamp}</p>
                        <p className="mt-0.5 text-xs text-gray-700">{item.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
