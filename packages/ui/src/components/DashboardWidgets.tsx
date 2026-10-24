import type { ReactNode } from "react";

import { DashboardIcon } from "./DashboardIcon";

export function DashboardSection({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section aria-label={title} className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-brand-maroon flex items-center gap-2 text-base font-bold">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DashboardLoading({ label }: { label: string }) {
  return (
    <div>
      <p role="status" className="sr-only">
        {label}
      </p>
      <div
        aria-hidden="true"
        className="bg-brand-skeleton/25 h-32 animate-pulse rounded-xl motion-reduce:animate-none"
      />
    </div>
  );
}

export function DashboardEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="border-brand-border/25 text-brand-muted rounded-xl border bg-white px-5 py-6 text-sm">
      {children}
    </p>
  );
}

export function DashboardMetric({
  label,
  value,
  icon,
  detail,
  highlight = false,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  detail?: string;
  highlight?: boolean;
}) {
  return (
    <article
      className={`border-brand-border/25 min-w-0 rounded-xl border p-6 shadow-sm ${highlight ? "bg-brand-maroon text-white" : "bg-white"}`}
    >
      <h2 className="text-xs font-semibold tracking-wide uppercase">{label}</h2>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p
          className={`min-w-0 font-bold tracking-tight break-words ${value === "Unavailable" ? "text-lg" : "text-3xl"}`}
        >
          {value}
        </p>
        {icon && (
          <span
            className={`grid size-11 shrink-0 place-items-center rounded-lg ${highlight ? "bg-white/15" : "bg-brand-skeleton/20"}`}
          >
            {icon}
          </span>
        )}
      </div>
      {detail && (
        <p className={`mt-2 text-xs ${highlight ? "text-white/90" : "text-brand-success"}`}>
          {detail}
        </p>
      )}
    </article>
  );
}

export function DashboardCalendar({
  events,
}: {
  events: { id: string; date: string; title: string; details: string }[];
}) {
  return (
    <DashboardSection title="Academic Calendar" icon={<DashboardIcon name="calendar" />}>
      {events.length === 0 ? (
        <DashboardEmpty>No upcoming events scheduled.</DashboardEmpty>
      ) : (
        <ul className="border-brand-border/25 divide-brand-border/25 divide-y rounded-xl border bg-white px-5 shadow-sm">
          {events.map((event) => (
            <li key={event.id} className="flex gap-4 py-4">
              <time dateTime={event.date} className="text-brand-maroon w-10 shrink-0 text-center">
                <span className="block text-xl leading-tight font-bold">
                  {event.date.slice(-2)}
                </span>
                <span className="block text-xs font-semibold uppercase">
                  {new Intl.DateTimeFormat("en-PH", {
                    month: "short",
                    timeZone: "Asia/Manila",
                  }).format(new Date(`${event.date}T00:00:00+08:00`))}
                </span>
                <span className="sr-only">{event.date.slice(0, 4)}</span>
              </time>
              <div>
                <h3 className="text-sm font-semibold">{event.title}</h3>
                <p className="text-brand-muted mt-1 text-xs leading-relaxed">{event.details}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}

export function DashboardAnnouncements({
  announcements,
}: {
  announcements: { id: string; source: string; title: string; body: string }[];
}) {
  return (
    <DashboardSection title="Announcements" icon={<DashboardIcon name="announcement" />}>
      {announcements.length === 0 ? (
        <DashboardEmpty>No announcements yet.</DashboardEmpty>
      ) : (
        announcements.map((item) => (
          <article
            key={item.id}
            className="border-brand-border/25 rounded-xl border bg-white px-5 py-4 shadow-sm"
          >
            <p className="text-brand-muted text-xs font-semibold uppercase">{item.source}</p>
            <h3 className="mt-2 text-sm font-semibold">{item.title}</h3>
            <p className="text-brand-muted mt-1 text-[13px] leading-relaxed">{item.body}</p>
          </article>
        ))
      )}
    </DashboardSection>
  );
}
