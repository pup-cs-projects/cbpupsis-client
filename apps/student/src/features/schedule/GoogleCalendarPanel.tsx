import { ApiError } from "@cbpupsis/shared/api";
import type { ScheduleTerm } from "@cbpupsis/shared/schedule";
import { useRef, useState } from "react";

import {
  GOOGLE_CALENDAR_MESSAGES,
  googleCalendarError,
  termKey,
  termLabel,
} from "./googleCalendar";
import { GoogleCalendarDisconnectDialog } from "./GoogleCalendarDisconnectDialog";
import type { GoogleCalendarController } from "./useGoogleCalendar";

const button =
  "border-brand-border/40 focus-visible:outline-offset-0! min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50";
const field =
  "border-brand-input-border focus-visible:outline-offset-0! min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2 text-sm";
const semesters = { first: "First Semester", second: "Second Semester", summer: "Summer Term" };
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(new Date(value))
    : "Not scheduled";

export function GoogleCalendarPanel({
  calendar,
  currentTerm,
  showConnectButton = false,
}: {
  calendar: GoogleCalendarController;
  currentTerm?: ScheduleTerm;
  showConnectButton?: boolean;
}) {
  const { status, busy } = calendar;
  const connection = status.data;
  const refreshButton = useRef<HTMLButtonElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [draftTerms, setDraftTerms] = useState<ScheduleTerm[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[] | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [semester, setSemester] = useState<string | null>(null);
  const [termError, setTermError] = useState("");
  const pinned = connection?.targets ?? [];
  const pinnedKeys = new Set(pinned.map(termKey));
  const available = [
    ...new Map(
      [...pinned, ...(currentTerm ? [currentTerm] : []), ...draftTerms].map((term) => [
        termKey(term),
        term,
      ]),
    ).values(),
  ];
  const defaultTerm =
    currentTerm && (pinnedKeys.has(termKey(currentTerm)) || pinned.length < 10)
      ? currentTerm
      : pinned[0];
  const selected = selectedKeys ?? (defaultTerm ? [termKey(defaultTerm)] : []);
  const chosen = available.filter((term) => selected.includes(termKey(term)));
  const allocated = new Set([...pinned, ...chosen].map(termKey));
  const active = Boolean(
    status.isSuccess && connection?.enabled && connection.connected && !connection.disconnecting,
  );
  const forbidden = status.error instanceof ApiError && status.error.status === 403;
  const draftYear = year ?? currentTerm?.year ?? "";
  const draftSemester = semester ?? currentTerm?.semester ?? "first";

  function addTerm() {
    const term = { year: draftYear.trim(), semester: draftSemester.trim() };
    if (!term.year || !term.semester)
      return setTermError("Enter an academic year and choose a semester.");
    if (available.some((item) => termKey(item) === termKey(term)))
      return setTermError("That term is already listed. Select it above.");
    if (new Set([...pinned, ...chosen, term].map(termKey)).size > 10)
      return setTermError(
        "A connection can sync up to ten terms. Already linked terms still count.",
      );
    setDraftTerms((terms) => [...terms, term]);
    setSelectedKeys([...selected, termKey(term)]);
    setTermError("");
  }

  return (
    <section
      id="google-calendar-sync"
      tabIndex={-1}
      aria-labelledby="google-calendar-heading"
      className="border-brand-border/25 rounded-2xl border bg-white p-5 shadow-sm focus-visible:outline-none print:hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="google-calendar-heading" className="text-brand-ink text-base font-bold">
          Google Calendar
        </h2>
        <button
          type="button"
          disabled={busy || status.isFetching}
          onClick={calendar.refresh}
          className={button}
          ref={refreshButton}
          aria-label="Refresh Google Calendar status"
        >
          {status.isFetching ? "Refreshing…" : "Refresh status"}
        </button>
      </div>
      {status.isPending && (
        <p role="status" className="text-brand-muted mt-4 text-sm">
          Loading Google Calendar status…
        </p>
      )}
      {status.isError && (
        <div className="mt-4 space-y-3">
          <p role="alert" className="text-brand-maroon text-sm">
            {googleCalendarError(status.error)}
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
      {calendar.feedback && (
        <p
          role={calendar.feedback.tone === "error" ? "alert" : "status"}
          className={`mt-4 text-sm leading-relaxed ${calendar.feedback.tone === "error" ? "text-brand-maroon" : "text-brand-help"}`}
        >
          {calendar.feedback.message}
        </p>
      )}
      {connection && (
        <>
          {!connection.enabled && (
            <p role="status" className="text-brand-muted mt-4 text-sm">
              {calendar.canConnect
                ? GOOGLE_CALENDAR_MESSAGES.connectAttempt
                : GOOGLE_CALENDAR_MESSAGES.disabled}
            </p>
          )}
          <p className="mt-4 text-sm font-semibold">
            {connection.disconnecting
              ? "Disconnecting"
              : connection.connected
                ? "Connected"
                : "Not connected"}
          </p>
          {connection.disconnecting && (
            <p className="text-brand-muted mt-2 text-sm leading-relaxed">
              Google authorization removal is pending. Refresh status before connecting again. Your
              calendar stays in Google.
            </p>
          )}
          {!connection.connected && !connection.disconnecting && connection.enabled && (
            <p className="text-brand-muted mt-2 text-sm leading-relaxed">
              Choose or sign in to a Google account, then allow Calendar access. Your current term
              will sync automatically to the account you select.
            </p>
          )}
          {connection.connected &&
            !connection.disconnecting &&
            !connection.lastSyncAt &&
            !connection.lastError &&
            connection.nextSyncAt && (
              <p role="status" className="text-brand-help mt-2 text-sm leading-relaxed">
                Your schedule is queued to sync to the Google account you selected. Refresh status
                to check progress.
              </p>
            )}
          {connection.lastError && (
            <div role="alert" className="text-brand-maroon mt-3 text-sm break-words">
              <p>Last sync error: {connection.lastError}</p>
              {connection.lastError === "reconnectRequired" && (
                <p className="mt-1">Reconnect your Google account to resume syncing.</p>
              )}
            </div>
          )}
          {(connection.connected || connection.disconnecting || connection.lastSyncAt) && (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-brand-muted text-xs">Last successful sync (Manila)</dt>
                <dd className="mt-1">
                  {connection.lastSyncAt ? (
                    <time dateTime={connection.lastSyncAt}>{date(connection.lastSyncAt)}</time>
                  ) : (
                    "No successful sync yet"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-brand-muted text-xs">Next sync attempt (Manila)</dt>
                <dd className="mt-1">
                  {connection.nextSyncAt ? (
                    <time dateTime={connection.nextSyncAt}>{date(connection.nextSyncAt)}</time>
                  ) : (
                    "Not scheduled"
                  )}
                </dd>
              </div>
            </dl>
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
          {connection.connected && (
            <div className="border-brand-border/20 mt-5 border-t pt-4">
              <fieldset disabled={busy || !active} aria-describedby="calendar-term-help">
                <legend className="text-sm font-semibold">Terms to sync</legend>
                <p
                  id="calendar-term-help"
                  className="text-brand-muted mt-2 text-xs leading-relaxed"
                >
                  Select up to 10 terms. Linked terms count toward the limit. Unchecking a term only
                  skips this sync.
                </p>
                <div className="mt-3 space-y-2">
                  {available.map((term, index) => {
                    const key = termKey(term);
                    const checked = selected.includes(key);
                    return (
                      <label
                        key={key}
                        className="border-brand-border/25 flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"
                      >
                        <input
                          className="accent-brand-maroon mt-0.5 size-4 shrink-0"
                          type="checkbox"
                          checked={checked}
                          disabled={!checked && allocated.size >= 10 && !pinnedKeys.has(key)}
                          aria-describedby={
                            pinnedKeys.has(key) ? `calendar-linked-${index}` : undefined
                          }
                          onChange={(event) => {
                            setSelectedKeys(
                              event.target.checked
                                ? [...selected, key]
                                : selected.filter((value) => value !== key),
                            );
                            setTermError("");
                          }}
                        />
                        <span className="min-w-0 break-words">
                          {termLabel(term)}
                          {pinnedKeys.has(key) && (
                            <span
                              id={`calendar-linked-${index}`}
                              className="text-brand-muted mt-1 block text-xs"
                            >
                              Linked term
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-4 grid min-w-0 gap-3">
                  <div>
                    <label
                      htmlFor="calendar-academic-year"
                      className="mb-1 block text-xs font-semibold"
                    >
                      Academic year
                    </label>
                    <input
                      id="calendar-academic-year"
                      value={draftYear}
                      onChange={(event) => setYear(event.target.value)}
                      maxLength={20}
                      placeholder="2026-2027"
                      className={field}
                    />
                  </div>
                  <div>
                    <label htmlFor="calendar-semester" className="mb-1 block text-xs font-semibold">
                      Semester
                    </label>
                    <select
                      id="calendar-semester"
                      value={draftSemester}
                      onChange={(event) => setSemester(event.target.value)}
                      className={`${field} cursor-pointer`}
                    >
                      {!(draftSemester in semesters) && (
                        <option value={draftSemester}>{draftSemester}</option>
                      )}
                      {Object.entries(semesters).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button type="button" onClick={addTerm} className={button}>
                    Add term to selection
                  </button>
                </div>
              </fieldset>
              {termError && (
                <p role="alert" className="text-brand-maroon mt-3 text-sm">
                  {termError}
                </p>
              )}
              <p className="text-brand-muted mt-3 text-xs">
                {pinned.length} of 10 terms linked · {chosen.length} selected
              </p>
              <button
                type="button"
                disabled={
                  busy || !active || !chosen.length || chosen.length > 10 || allocated.size > 10
                }
                onClick={() =>
                  void calendar.sync(chosen).then((result) => {
                    if (!result.success && result.queuedTerms.length)
                      setSelectedKeys(selected.filter((key) => !result.queuedTerms.includes(key)));
                  })
                }
                className={`${button} bg-brand-maroon hover:bg-brand-maroon-dark mt-3 w-full text-white`}
              >
                {calendar.syncing ? "Queuing sync…" : "Sync selected terms"}
              </button>
              <p className="text-brand-muted mt-2 text-xs leading-relaxed">
                Sync runs in the background. Refresh status to check progress. Google changes do not
                update your SIS schedule.
              </p>
            </div>
          )}
        </>
      )}
      {(connection?.connected || forbidden) && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            calendar.clearFeedback();
            setConfirming(true);
          }}
          className={`${button} text-brand-maroon mt-4 w-full`}
        >
          Disconnect Google Calendar
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
              }
            })
          }
        />
      )}
    </section>
  );
}
