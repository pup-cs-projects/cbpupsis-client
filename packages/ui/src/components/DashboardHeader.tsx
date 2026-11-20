import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { DashboardIcon } from "./DashboardIcon";

type RenderLink = (className: string, children: ReactNode) => ReactNode;
export type PortalSearchItem = { label: string; content: ReactNode };

/** The same search, bell and account cluster as the student portal, with role-owned links. */
export function DashboardHeader({
  name,
  email,
  identifier,
  items,
  profileLink,
  passwordLink,
  notificationsLink,
  signOut,
}: {
  name: string;
  email?: string | null;
  identifier?: string | null;
  items: PortalSearchItem[];
  profileLink?: RenderLink;
  passwordLink: RenderLink;
  notificationsLink: RenderLink;
  signOut: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const accountId = useId();
  const initial = (Array.from(name.trim())[0]?.toUpperCase() || "?")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const avatar = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><text x="18" y="18" dy=".35em" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#800000">${initial}</text></svg>`)}`;
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (container.current?.closest("[inert]")) return;
      if (event.target instanceof Element && event.target.closest('[role="alertdialog"]')) return;
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (container.current?.closest("[inert]") || event.key !== "Escape") return;
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
  const itemClass =
    "flex min-h-11 w-full items-center px-4 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 focus-visible:-outline-offset-2!";
  return (
    <div className="flex shrink-0 items-center gap-1 sm:gap-2 print:hidden">
      <PageSearch items={items} />
      {notificationsLink(
        "grid size-11 shrink-0 place-items-center rounded-full text-neutral-700 hover:bg-neutral-100",
        <>
          <DashboardIcon name="bell" />
          <span className="sr-only">Notifications</span>
        </>,
      )}
      <div ref={container} className="relative">
        <button
          ref={trigger}
          type="button"
          aria-expanded={open}
          aria-controls={accountId}
          aria-label={`Account menu for ${name}`}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl p-1.5 text-neutral-800 transition-colors hover:bg-neutral-100"
        >
          <span
            aria-hidden="true"
            className="hidden max-w-28 truncate text-sm font-semibold sm:inline"
          >
            {name.split(" ")[0]}
          </span>
          <img
            src={avatar}
            alt=""
            width="36"
            height="36"
            className="bg-brand-maroon/10 size-9 rounded-full border border-neutral-200"
          />
          <DashboardIcon name="chevron" className="size-4 text-neutral-500" />
        </button>
        {open && (
          <div
            id={accountId}
            className="absolute right-0 z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-neutral-200 bg-white py-2 shadow-lg"
          >
            <div className="border-b border-neutral-100 px-4 py-3">
              <p className="text-sm font-semibold break-words text-neutral-900">{name}</p>
              {identifier && (
                <p className="mt-1 text-xs break-words text-neutral-500">{identifier}</p>
              )}
              {email && <p className="mt-1 text-xs break-all text-neutral-500">{email}</p>}
            </div>
            <div
              onClickCapture={(event) => {
                if (event.target instanceof Element && event.target.closest("a[href]"))
                  setOpen(false);
              }}
            >
              {profileLink?.(itemClass, "Profile")}
              {passwordLink(itemClass, "Change Password")}
              {signOut}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PageSearch({ items }: { items: PortalSearchItem[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const resultId = useId();
  const matching = items.filter((item) =>
    item.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return (
    <div
      ref={container}
      className="md:relative"
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          setQuery("");
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={open ? "Close search" : "Search"}
        aria-expanded={open}
        aria-controls={resultId}
        className="grid size-11 cursor-pointer place-items-center rounded-full text-neutral-700 hover:bg-neutral-100 md:hidden"
        onClick={() => setOpen((value) => !value)}
      >
        <DashboardIcon name={open ? "close" : "search"} />
      </button>
      <div
        className={`${open ? "absolute inset-x-0 top-full border-b border-neutral-200 bg-white p-3 shadow-sm" : "hidden"} md:static md:block md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
      >
        <form
          role="search"
          className="relative"
          onSubmit={(event) => {
            event.preventDefault();
            if (query.trim())
              container.current?.querySelector<HTMLAnchorElement>(`[id="${resultId}"] a`)?.click();
          }}
        >
          <DashboardIcon
            name="search"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400"
          />
          <input
            ref={input}
            type="search"
            aria-label="Search pages"
            placeholder="Search for schedules, grades, forms"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="focus:border-brand-maroon focus:ring-brand-maroon/20 min-h-11 w-full rounded-xl border border-neutral-200 bg-neutral-50/80 py-2 pr-4 pl-10 text-sm text-neutral-800 transition-colors focus:bg-white focus:ring-2 focus:outline-none md:w-64 lg:w-80"
          />
        </form>
        <div id={resultId}>
          {query.trim() && (
            <div
              className="mt-2 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg md:absolute md:inset-x-0 md:top-full"
              onClickCapture={(event) => {
                if (event.target instanceof Element && event.target.closest("a[href]")) {
                  setOpen(false);
                  setQuery("");
                }
              }}
            >
              <p role="status" className="px-2 py-1 text-xs text-neutral-500">
                {matching.length ? `${matching.length} pages found` : "No matching pages"}
              </p>
              <ul>
                {matching.map((item) => (
                  <li key={item.label}>{item.content}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
