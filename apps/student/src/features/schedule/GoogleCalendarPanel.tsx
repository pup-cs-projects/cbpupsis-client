import { ApiError } from "@cbpupsis/shared/api";
import type { ScheduleTerm } from "@cbpupsis/shared/schedule";
import { useRef, useState } from "react";

import {
  GOOGLE_CALENDAR_MESSAGES,
  googleCalendarStatusError,
  termKey,
  termLabel,
} from "./googleCalendar";
import { GoogleCalendarDisconnectDialog } from "./GoogleCalendarDisconnectDialog";
import type { GoogleCalendarController } from "./useGoogleCalendar";

const MAX_TERMS = 10;
const button =
  "border-brand-border/40 focus-visible:outline-offset-0! min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50";
const date = (value: string | null, empty: string) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(new Date(value))
    : empty;

/**
 * Google Calendar connection: status, sync times, the terms to sync, Sync now and Disconnect.
 * `bare` is the pop-up body (the pop-up supplies the title and surface); otherwise it is a card.
 */
export function GoogleCalendarPanel({
  calendar,
  currentTerm,
  showConnectButton = false,
  bare = false,
  onDisconnected,
}: {
  calendar: GoogleCalendarController;
  currentTerm?: ScheduleTerm;
  showConnectButton?: boolean;
  bare?: boolean;
  /** Called once a disconnect has been accepted, e.g. so the pop-up can close. */
  onDisconnected?: () => void;
}) {
  const { status, busy } = calendar;
  const connection = status.data;
  const refreshButton = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[] | null>(null);

  // The student's terms are the ones already linked plus the current one. No free-form entry.
  const pinned = connection?.targets ?? [];
  const pinnedKeys = new Set(pinned.map(termKey));
  const available = [
    ...new Map(
      [...pinned, ...(currentTerm ? [currentTerm] : [])].map((term) => [termKey(term), term]),
    ).values(),
  ];
  // The current term is checked by default, unless the ten-term limit has no room for it.
  const defaultTerm =
    currentTerm && (pinnedKeys.has(termKey(currentTerm)) || pinned.length < MAX_TERMS)
      ? currentTerm
      : pinned[0];
  const selected = selectedKeys ?? (defaultTerm ? [termKey(defaultTerm)] : []);
  const chosen = available.filter((term) => selected.includes(termKey(term)));
  const allocated = new Set([...pinned, ...chosen].map(termKey));
  const active = Boolean(
    status.isSuccess && connection?.enabled && connection.connected && !connection.disconnecting,
  );
  const forbidden = status.error instanceof ApiError && status.error.status === 403;
  const noneChosen = chosen.length === 0;
  // After Connect, before the first sync finishes: the API has already queued it.
  const queued = Boolean(
    connection?.connected &&
    !connection.disconnecting &&
    !connection.lastSyncAt &&
    !connection.lastError &&
    connection.nextSyncAt &&
    !calendar.feedback,
  );

  return (
    <section
      id="google-calendar-sync"
      tabIndex={-1}
      aria-labelledby="google-calendar-heading"
      className={
        bare
          ? "min-w-0 focus-visible:outline-none print:hidden"
          : "border-brand-border/25 rounded-2xl border bg-white p-5 shadow-sm focus-visible:outline-none print:hidden"
      }
    >
      {!bare && (
        <h2 id="google-calendar-heading" className="text-brand-ink text-base font-bold">
          Google Calendar
        </h2>
      )}
      {status.isPending && (
        <p role="status" className="text-brand-muted text-sm">
          Loading Google Calendar status…
        </p>
      )}
      {status.isError && (
        <div className="space-y-3">
          <p role="alert" className="text-brand-maroon text-sm">
            {googleCalendarStatusError(status.error)}
          </p>
          <button
            type="button"
            onClick={calendar.refresh}
            disabled={status.isFetching}
            className={button}
          >
            Retry Google Calendar status
          </button>
        </div>
      )}
      {connection && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">
              {connection.disconnecting
                ? "Disconnecting"
                : connection.connected
                  ? "Connected"
                  : "Not connected"}
            </p>
            <button
              type="button"
              disabled={busy || status.isFetching}
              onClick={calendar.refresh}
              className={`${button} shrink-0`}
              ref={refreshButton}
              aria-label="Refresh Google Calendar status"
            >
              {status.isFetching ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          {!connection.enabled && (
            <p role="status" className="text-brand-muted mt-3 text-sm">
              {calendar.canConnect
                ? GOOGLE_CALENDAR_MESSAGES.connectAttempt
                : GOOGLE_CALENDAR_MESSAGES.disabled}
            </p>
          )}
          {(connection.connected || connection.disconnecting || connection.lastSyncAt) && (
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex flex-wrap justify-between gap-x-4">
                <dt className="text-brand-muted">Last sync</dt>
                <dd>
                  {connection.lastSyncAt ? (
                    <time dateTime={connection.lastSyncAt}>
                      {date(connection.lastSyncAt, "Never")}
                    </time>
                  ) : (
                    "Never"
                  )}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4">
                <dt className="text-brand-muted">Next sync</dt>
                <dd>
                  {connection.nextSyncAt ? (
                    <time dateTime={connection.nextSyncAt}>
                      {date(connection.nextSyncAt, "Not scheduled")}
                    </time>
                  ) : (
                    "Not scheduled"
                  )}
                </dd>
              </div>
            </dl>
          )}
          {connection.lastError && (
            <div role="alert" className="text-brand-maroon mt-3 text-sm break-words">
              <p>Last sync error: {connection.lastError}</p>
              {connection.lastError === "reconnectRequired" && (
                <p className="mt-1">Reconnect your Google account to resume syncing.</p>
              )}
            </div>
          )}
          {queued && (
            <p role="status" className="text-brand-help mt-3 text-sm">
              Sync queued
            </p>
          )}
          {showConnectButton && !connection.connected && (
            <button
              type="button"
              disabled={!calendar.canConnect || busy}
              onClick={() => calendar.connect(currentTerm)}
              className={`${button} bg-brand-maroon mt-4 text-white`}
            >
              {calendar.connecting ? "Opening Google…" : "Connect to Google Calendar"}
            </button>
          )}
        </>
      )}
      {calendar.feedback && (
        <p
          role={calendar.feedback.tone === "error" ? "alert" : "status"}
          className={`mt-3 text-sm leading-relaxed ${calendar.feedback.tone === "error" ? "text-brand-maroon" : "text-brand-help"}`}
        >
          {calendar.feedback.message}
        </p>
      )}
      {connection?.connected && (
        <div className="mt-5">
          <fieldset disabled={busy || !active} className="min-w-0">
            <legend className="text-sm font-semibold">Terms to sync</legend>
            <div className="mt-3 space-y-2">
              {available.map((term) => {
                const key = termKey(term);
                const checked = selected.includes(key);
                return (
                  <label
                    key={key}
                    className="border-brand-border/25 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                  >
                    <input
                      className="accent-brand-maroon size-4 shrink-0"
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && allocated.size >= MAX_TERMS && !pinnedKeys.has(key)}
                      onChange={(event) =>
                        setSelectedKeys(
                          event.target.checked
                            ? [...selected, key]
                            : selected.filter((value) => value !== key),
                        )
                      }
                    />
                    <span className="min-w-0 break-words">{termLabel(term)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {noneChosen && (
            <p id="calendar-terms-required" className="text-brand-muted mt-2 text-xs">
              Select at least one term
            </p>
          )}
          <button
            type="button"
            aria-describedby={noneChosen ? "calendar-terms-required" : undefined}
            disabled={
              busy ||
              !active ||
              noneChosen ||
              chosen.length > MAX_TERMS ||
              allocated.size > MAX_TERMS
            }
            onClick={() =>
              void calendar.sync(chosen).then((result) => {
                if (!result.success && result.queuedTerms.length)
                  setSelectedKeys(selected.filter((key) => !result.queuedTerms.includes(key)));
              })
            }
            className={`${button} bg-brand-maroon hover:bg-brand-maroon-dark mt-3 w-full text-white`}
          >
            {calendar.syncing ? "Queuing sync…" : "Sync now"}
          </button>
        </div>
      )}
      {(connection?.connected || forbidden) && (
        <button
          type="button"
          disabled={busy}
          aria-label="Disconnect Google Calendar"
          onClick={() => {
            calendar.clearFeedback();
            setConfirming(true);
          }}
          className={`${button} text-brand-maroon mt-3 w-full`}
        >
          Disconnect
        </button>
      )}
      {confirming && (
        <GoogleCalendarDisconnectDialog
          busy={calendar.removing}
          error={calendar.feedback?.tone === "error" ? calendar.feedback.message : undefined}
          onCancel={() => setConfirming(false)}
          onConfirm={() =>
            void calendar.disconnect().then((success) => {
              if (success) {
                setConfirming(false);
                setTimeout(() => refreshButton.current?.focus(), 0);
                onDisconnected?.();
              }
            })
          }
        />
      )}
    </section>
  );
}
