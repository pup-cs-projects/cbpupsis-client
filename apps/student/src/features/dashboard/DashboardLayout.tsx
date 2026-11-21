import { SignOutButton } from "@cbpupsis/account";
import { Link, useLocation, type LinkProps } from "@tanstack/react-router";
import { Bell, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useHeaderAvatar } from "../profile/useAvatar";
import { useMe } from "../sign-in/queries";
import { useStudentIdentity } from "./queries";

// ---- Icons (decorative: the label or the button's name carries the meaning) ----

function Icon({ children, className = "size-5" }: { children: ReactNode; className?: string }) {
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

const MenuIcon = () => (
  <Icon>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icon>
);
const HomeIcon = () => (
  <Icon>
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </Icon>
);
const AcademicsIcon = () => (
  <Icon>
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <path d="M9 7h6M9 11h6M9 15h4" />
  </Icon>
);
const BriefcaseIcon = () => (
  <Icon>
    <rect x="2" y="7" width="20" height="14" rx="2" />
    <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
  </Icon>
);
const MailIcon = () => (
  <Icon>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M2 7l10 7 10-7" />
  </Icon>
);
const HelpIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
    <circle cx="12" cy="17" r=".5" fill="currentColor" />
  </Icon>
);
const ChevronDownIcon = () => (
  <Icon className="size-3.5">
    <path d="M6 9l6 6 6-6" />
  </Icon>
);

// ---- Data ----

// Items without a `to` or `href` have no route yet: unavailable, never a dead link.
type SubItem = { label: string; to?: LinkProps["to"]; href?: string };

type NavSection = {
  id: string;
  label: string;
  icon: ReactNode;
  children?: SubItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    id: "academics",
    label: "Academics",
    icon: <AcademicsIcon />,
    children: [
      { label: "My Schedule", to: "/schedule" },
      { label: "My Grades", to: "/grades" },
      { label: "Enrollment", to: "/enrollment" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: <BriefcaseIcon />,
    children: [{ label: "Billing & Payments" }],
  },
  {
    id: "forms",
    label: "Forms & Requests",
    icon: <MailIcon />,
    children: [
      { label: "Add or Drop Courses", to: "/enrollment/add-drop" },
      { label: "Track Requests" },
    ],
  },
  // Profile, Settings (with Change Password), and Logout live in the header's account menu.
];

// A utility link, not a module: pinned to the bottom of the sidebar, apart from the list above.
// The same support address as the sign-in page.
const HELP_LINK = {
  label: "Help & Support",
  icon: <HelpIcon />,
  href: "mailto:icto-admin@pup.edu.ph",
};

const SIDEBAR_ID = "student-sidebar";
const SEARCH_LABEL = "Search for schedules, grades, forms...";

// ---- Component ----

/**
 * The student portal's frame: a white header (seal, name, the search/notifications/account
 * cluster), the collapsible obelisk sidebar (a drawer below 768px), and the main landmark the
 * skip link jumps to.
 */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(() => {
    try {
      return localStorage.getItem("student-sidebar-expanded") === "true";
    } catch {
      return false;
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = useLocation({ select: (location) => location.pathname });
  // The section holding the current page: open on arrival, and marked even when collapsed.
  const activeSection = NAV_SECTIONS.find((section) =>
    section.children?.some((item) => item.to === pathname),
  )?.id;
  const [openSection, setOpenSection] = useState<string | null>(activeSection ?? null);

  function persistExpanded(next: boolean) {
    setIsExpanded(next);
    try {
      localStorage.setItem("student-sidebar-expanded", String(next));
    } catch {
      // Storage unavailable (private mode, quota) — the preference just won't persist.
    }
  }
  const menuButton = useRef<HTMLButtonElement>(null);
  const expanded = isExpanded || drawerOpen;

  // Escape closes the drawer and hands focus back to the button that opened it.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setDrawerOpen(false);
      menuButton.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  function handleSectionClick(id: string) {
    if (!expanded) {
      persistExpanded(true);
      setOpenSection(id);
    } else {
      setOpenSection((prev) => (prev === id ? null : id));
    }
  }

  const navItemBase =
    "flex min-h-11 w-full items-center py-3 text-white/90 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-brand-gold! focus-visible:-outline-offset-2!";
  const subItem =
    "flex min-h-11 w-full items-center py-2.5 pr-4 pl-12 text-left text-sm text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-brand-gold! focus-visible:-outline-offset-2!";

  return (
    <div className="text-brand-ink flex h-dvh flex-col overflow-hidden print:block print:h-auto print:overflow-visible">
      <a
        href="#dashboard-main"
        className="focus:text-brand-maroon-dark sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:font-semibold focus:shadow-lg print:hidden"
      >
        Skip to content
      </a>

      {/* ---- Full-width top header ---- */}
      <header className="border-brand-border/30 relative z-20 flex h-[72px] shrink-0 items-center justify-between gap-2 border-b bg-white px-4 md:gap-4 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            ref={menuButton}
            type="button"
            className="text-brand-maroon hover:bg-brand-maroon/10 grid size-11 shrink-0 place-items-center rounded-lg md:hidden print:hidden"
            aria-label="Menu"
            aria-expanded={drawerOpen}
            aria-controls={SIDEBAR_ID}
            onClick={() => setDrawerOpen((open) => !open)}
          >
            <MenuIcon />
          </button>
          <Link to="/dashboard" className="flex min-h-11 items-center gap-3 rounded-md">
            <img
              src="/apple-touch-icon.png"
              alt=""
              width="48"
              height="48"
              className="size-10 shrink-0 md:size-12"
            />
            <span className="leading-snug">
              <span className="text-brand-maroon block text-[22px] leading-none font-bold tracking-tight">
                CBPUPSIS
              </span>
              <span className="text-brand-maroon hidden text-xs leading-tight font-medium sm:block">
                PUP Academic Portal
              </span>
            </span>
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2 print:hidden">
          <SearchField />
          <NotificationBell />
          <UserMenu />
        </div>
      </header>

      {/* ---- Body row: sidebar + main ---- */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden print:block print:overflow-visible">
        {drawerOpen && (
          <div
            aria-hidden="true"
            className="bg-brand-ink/40 fixed inset-0 z-30 md:hidden"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        {/* ---- Sidebar ---- */}
        <aside
          id={SIDEBAR_ID}
          aria-label="Modules"
          className={`bg-brand-maroon-dark shrink-0 flex-col overflow-hidden bg-cover bg-center transition-all duration-300 ease-in-out motion-reduce:transition-none print:hidden ${
            drawerOpen ? "fixed inset-y-0 left-0 z-40 flex w-72" : "hidden md:flex"
          } ${isExpanded ? "md:w-72" : "md:w-16"}`}
          style={{ backgroundImage: "url(/assets/obelisk.webp)" }}
        >
          <nav aria-label="Student modules" className="flex min-h-0 flex-1 flex-col py-2">
            {/* The modules scroll on a short screen; Help & Support below never scrolls away. */}
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
              {/* Dashboard / hamburger toggle */}
              <button
                type="button"
                className={`${navItemBase} ${expanded ? "gap-3 px-[18px]" : "justify-center"}`}
                aria-label={expanded ? "Collapse menu" : "Expand menu"}
                aria-expanded={expanded}
                aria-controls={SIDEBAR_ID}
                onClick={() => {
                  if (drawerOpen) {
                    setDrawerOpen(false);
                    menuButton.current?.focus();
                  } else persistExpanded(!isExpanded);
                }}
              >
                <MenuIcon />
              </button>

              <div className="mx-3 my-1.5 border-t border-white/15" />

              {/* Dashboard — wired route with active highlight */}
              <Link
                to="/dashboard"
                activeOptions={{ includeSearch: false }}
                aria-label="Dashboard"
                className={`${navItemBase} ${expanded ? "gap-3 px-[18px]" : "justify-center"} aria-[current=page]:bg-white/20 aria-[current=page]:text-white`}
              >
                <HomeIcon />
                {expanded && (
                  <span
                    className="flex-1 text-left text-sm font-semibold whitespace-nowrap"
                    aria-hidden="true"
                  >
                    Dashboard
                  </span>
                )}
              </Link>

              <div className="mx-3 my-1.5 border-t border-white/15" />

              <ul>
                {NAV_SECTIONS.map((section) => {
                  const open = expanded && openSection === section.id;
                  const rowClass = `${navItemBase} ${expanded ? "gap-3 px-[18px]" : "justify-center"} ${
                    open || section.id === activeSection ? "bg-white/10 text-white" : ""
                  }`;
                  return (
                    <li key={section.id}>
                      <button
                        type="button"
                        className={rowClass}
                        aria-label={section.label}
                        aria-expanded={open}
                        onClick={() => handleSectionClick(section.id)}
                      >
                        {section.icon}
                        {expanded && (
                          <>
                            <span
                              className="flex-1 text-left text-sm font-medium whitespace-nowrap"
                              aria-hidden="true"
                            >
                              {section.label}
                            </span>
                            <span
                              className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                            >
                              <ChevronDownIcon />
                            </span>
                          </>
                        )}
                      </button>

                      {/* Submenu */}
                      {open && section.children && (
                        <ul className="bg-black/15">
                          {section.children.map((item) => (
                            <li key={item.label}>
                              {item.to ? (
                                <Link
                                  to={item.to}
                                  className={`${subItem} aria-[current=page]:bg-white/20 aria-[current=page]:font-semibold aria-[current=page]:text-white aria-[current=page]:shadow-[inset_4px_0_0_var(--color-brand-gold)]`}
                                >
                                  {item.label}
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  className={`${subItem} cursor-default`}
                                  aria-disabled="true"
                                >
                                  {item.label}
                                  <span className="sr-only">, coming soon</span>
                                  <span
                                    aria-hidden="true"
                                    className="ml-auto rounded-full border border-white/40 px-2 text-xs"
                                  >
                                    Soon
                                  </span>
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Help & Support: pinned to the bottom, set apart by a divider, in either state. */}
            <div className="mt-auto shrink-0">
              <div className="mx-3 mb-1.5 border-t border-white/15" />
              <a
                href={HELP_LINK.href}
                aria-label={`${HELP_LINK.label}: email portal support`}
                className={`${navItemBase} ${expanded ? "gap-3 px-[18px]" : "justify-center"}`}
              >
                {HELP_LINK.icon}
                {expanded && (
                  <span className="flex-1 text-left text-sm font-medium whitespace-nowrap">
                    {HELP_LINK.label}
                  </span>
                )}
              </a>
            </div>
          </nav>
        </aside>

        {/* ---- Main content ---- */}
        <main
          id="dashboard-main"
          tabIndex={-1}
          className="bg-brand-paper flex-1 overflow-y-auto focus-visible:outline-none! print:overflow-visible print:bg-white"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * The search field: a plain input docked beside the bell and account menu on desktop, an icon
 * that expands into the same input, as a panel beneath the header, on narrow screens.
 */
function SearchField() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleButton = useRef<HTMLButtonElement>(null);
  const mobileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mobileOpen) mobileInput.current?.focus();
  }, [mobileOpen]);

  function closeMobile() {
    setMobileOpen(false);
    toggleButton.current?.focus();
  }

  const fieldClass =
    "w-64 lg:w-80 rounded-xl border border-neutral-200 bg-neutral-50/80 py-2 pr-4 pl-10 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-crimson/20 focus:border-brand-crimson focus:bg-white transition-all";

  return (
    <>
      <button
        ref={toggleButton}
        type="button"
        aria-label={mobileOpen ? "Close search" : "Search"}
        aria-expanded={mobileOpen}
        className="rounded-full p-2.5 text-neutral-700 transition-colors hover:bg-neutral-100 md:hidden"
        onClick={() => setMobileOpen((open) => !open)}
      >
        {mobileOpen ? (
          <X className="size-5" aria-hidden="true" />
        ) : (
          <Search className="size-5" aria-hidden="true" />
        )}
      </button>

      <form
        role="search"
        className="relative hidden md:block"
        onSubmit={(event) => event.preventDefault()}
      >
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400"
        />
        <input
          type="search"
          aria-label={SEARCH_LABEL}
          placeholder={SEARCH_LABEL}
          className={fieldClass}
        />
      </form>

      {mobileOpen && (
        <div className="border-brand-border/30 absolute inset-x-0 top-full z-20 border-b bg-white p-3 shadow-sm md:hidden">
          <form role="search" className="relative" onSubmit={(event) => event.preventDefault()}>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400"
            />
            <input
              ref={mobileInput}
              type="search"
              aria-label={SEARCH_LABEL}
              placeholder={SEARCH_LABEL}
              className={`${fieldClass} w-full`}
              onKeyDown={(event) => event.key === "Escape" && closeMobile()}
            />
          </form>
        </div>
      )}
    </>
  );
}

/**
 * The notification bell. Not built yet (no notifications API) — unavailable, never a dead
 * link — but the unread badge is ready for when there is a count to show.
 */
function NotificationBell() {
  const unreadCount = 0;

  return (
    <button
      type="button"
      aria-disabled="true"
      title="Coming soon"
      className="relative cursor-default rounded-full p-2.5 text-neutral-700 transition-colors hover:bg-neutral-100"
    >
      <Bell className="size-5" aria-hidden="true" />
      <span className="sr-only">Notifications, coming soon</span>
      {unreadCount > 0 && (
        <span className="absolute top-1 right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
          {unreadCount}
        </span>
      )}
    </button>
  );
}

/**
 * The student's photo in a circle, or their initial on a plain circle only if the picture fails
 * to display. While the profile loads it is an empty circle, not a stand-in that then changes.
 */
function Avatar({ name, src, pending }: { name: string | null; src: string; pending: boolean }) {
  // The picture that failed, not a yes/no: a new photo gets its own try.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (pending) {
    return (
      <span
        aria-hidden="true"
        className="block h-9 w-9 animate-pulse rounded-full border border-neutral-200 bg-neutral-100 motion-reduce:animate-none"
      />
    );
  }
  if (src !== failedSrc) {
    return (
      <img
        src={src}
        alt=""
        className="h-9 w-9 rounded-full border border-neutral-200 object-cover"
        onError={() => setFailedSrc(src)}
      />
    );
  }
  const initial = name?.trim().charAt(0).toUpperCase() || "S";
  return (
    <span
      aria-hidden="true"
      className="bg-brand-crimson/10 text-brand-crimson flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-sm font-semibold"
    >
      {initial}
    </span>
  );
}

/**
 * Who is signed in: the student's avatar and a chevron beside the bell, opening a menu with the
 * full identity and Profile, Settings, and Logout (with its own confirmation). The trigger carries
 * no name of its own (its accessible name has it); the menu shows the name only once the API
 * gives one, never derived from the email.
 */
function UserMenu() {
  const me = useMe();
  const identity = useStudentIdentity();
  const avatar = useHeaderAvatar(identity.data?.avatarUrl ?? null);
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // Click-outside and Escape close the menu; Escape hands focus back to the trigger.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Element;
      // A portalled confirmation makes this menu inert; keep its owner mounted.
      if (container.current?.closest("[inert]")) return;
      // The sign-out confirmation is portaled to <body>; a click in it is not outside
      // the menu, and closing here would unmount it before the sign-out runs.
      if (target.closest?.('[role="alertdialog"]')) return;
      if (!container.current?.contains(target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (container.current?.closest("[inert]")) return;
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const fullName = identity.data?.fullName ?? null;

  return (
    <div ref={container} className="relative">
      {me.isPending && <p className="sr-only">Loading your account</p>}
      {me.isSuccess && <p className="sr-only">Signed in as {me.data.email}</p>}

      <button
        ref={trigger}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={fullName ? `Account menu for ${fullName}` : "Account menu"}
        className="flex cursor-pointer items-center gap-2 rounded-xl p-1.5 transition-colors hover:bg-neutral-100"
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={fullName} src={avatar.src} pending={avatar.pending} />
        <ChevronDown className="h-4 w-4 text-neutral-500" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-neutral-200 bg-white py-2 shadow-lg">
          <div className="px-4 py-2">
            <p className="truncate text-sm font-semibold text-neutral-900">
              {fullName ?? "Student"}
            </p>
            {identity.data?.studentNumber && (
              <p className="truncate text-xs text-neutral-500">{identity.data.studentNumber}</p>
            )}
            {me.isSuccess && <p className="truncate text-xs text-neutral-500">{me.data.email}</p>}
          </div>

          <div className="my-1 border-t border-neutral-100" />

          <Link
            to="/profile"
            className="focus-visible:outline-brand-crimson! block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <Link
            to="/settings"
            className="focus-visible:outline-brand-crimson! block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <SignOutButton className="focus-visible:outline-brand-crimson! block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">
            Logout
          </SignOutButton>
        </div>
      )}
    </div>
  );
}
