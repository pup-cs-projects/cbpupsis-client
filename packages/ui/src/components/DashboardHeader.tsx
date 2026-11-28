import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { DashboardIcon } from "./DashboardIcon";

type RenderLink = (className: string, children: ReactNode) => ReactNode;

/** The bell and account cluster for staff portals, with role-owned links. */
export function DashboardHeader({
  name,
  email,
  identifier,
  profileLink,
  passwordLink,
  notificationsLink,
  notifications,
  signOut,
}: {
  name: string;
  email?: string | null;
  identifier?: string | null;
  profileLink?: RenderLink;
  passwordLink: RenderLink;
  notificationsLink?: RenderLink;
  /** A bell that opens in place (NotificationsMenu); preferred over notificationsLink. */
  notifications?: ReactNode;
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
    "flex min-h-11 w-full cursor-pointer items-center px-4 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-brand-maroon focus-visible:-outline-offset-2!";
  return (
    <div className="flex shrink-0 items-center gap-1 sm:gap-2 print:hidden">
      {notifications ??
        notificationsLink?.(
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
