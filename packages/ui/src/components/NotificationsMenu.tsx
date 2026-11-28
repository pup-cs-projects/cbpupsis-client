import { useCallback, useEffect, useId, useRef, useState } from "react";

import { DashboardIcon } from "./DashboardIcon";

export interface NotificationsMenuItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

type State =
  { status: "loading" } | { status: "error" } | { status: "ready"; items: NotificationsMenuItem[] };

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * The header bell for every portal: opens a panel with the caller's latest notifications
 * instead of sending them to another page. The portal passes how to load and mark them read.
 */
export function NotificationsMenu({
  load,
  markAllRead,
  className = "relative grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-brand-maroon",
}: {
  load: (signal: AbortSignal) => Promise<NotificationsMenuItem[]>;
  markAllRead?: () => Promise<void>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Load once on mount (for the unread dot) and again every time the panel opens.
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((items) => setState({ status: "ready", items }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [load, open, reloadKey]);

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const unread = state.status === "ready" ? state.items.filter((item) => !item.read).length : 0;

  const readAll = useCallback(async () => {
    if (!markAllRead) return;
    try {
      await markAllRead();
    } finally {
      setReloadKey((key) => key + 1);
    }
  }, [markAllRead]);

  return (
    <div ref={container} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        title="Open notifications"
        className={className}
        onClick={() => setOpen((value) => !value)}
      >
        <DashboardIcon name="bell" />
        <span className="sr-only">Open notifications{unread > 0 ? `, ${unread} unread` : ""}</span>
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          id={panelId}
          role="region"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-neutral-200 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
            <p className="text-brand-maroon text-sm font-bold">Notifications</p>
            {markAllRead && unread > 0 && (
              <button
                type="button"
                className="text-brand-maroon cursor-pointer rounded px-2 py-1 text-xs font-semibold hover:bg-neutral-100"
                onClick={() => void readAll()}
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto py-1" aria-live="polite">
            {state.status === "loading" && (
              <p className="px-4 py-6 text-center text-sm text-neutral-500">
                Loading notifications...
              </p>
            )}
            {state.status === "error" && (
              <div className="px-4 py-6 text-center text-sm text-neutral-600">
                <p>We could not load your notifications.</p>
                <button
                  type="button"
                  className="text-brand-maroon mt-2 cursor-pointer font-semibold underline"
                  onClick={() => setReloadKey((key) => key + 1)}
                >
                  Try again
                </button>
              </div>
            )}
            {state.status === "ready" && state.items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-neutral-500">
                No notifications yet.
              </p>
            )}
            {state.status === "ready" && state.items.length > 0 && (
              <ul>
                {state.items.map((item) => (
                  <li
                    key={item.id}
                    className={`border-l-4 px-4 py-3 ${item.read ? "border-transparent" : "border-brand-maroon bg-brand-maroon/5"}`}
                  >
                    <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                    {item.body && <p className="mt-0.5 text-sm text-neutral-600">{item.body}</p>}
                    <p className="mt-1 text-xs text-neutral-500">{formatWhen(item.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
