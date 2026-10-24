import { SignOutButton } from "@cbpupsis/account";
import { Link, type LinkProps } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useMe } from "../sign-in/queries";
import { useStudentName } from "./queries";

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
const GearIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </Icon>
);
const HelpIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
    <circle cx="12" cy="17" r=".5" fill="currentColor" />
  </Icon>
);
const UserCircleIcon = () => (
  <Icon>
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Icon>
);
const ChevronDownIcon = () => (
  <Icon className="size-3.5">
    <path d="M6 9l6 6 6-6" />
  </Icon>
);
const SignOutIcon = () => (
  <Icon>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 17l-5-5 5-5M5 12h11" />
  </Icon>
);

// ---- Data ----

// Items without a `to` or `href` have no route yet: unavailable, never a dead link.
type SubItem = { label: string; to?: LinkProps["to"]; href?: string; kind?: "signout" };

type NavSection = {
  id: string;
  label: string;
  icon: ReactNode;
  children?: SubItem[];
  href?: string;
};

const NAV_SECTIONS: NavSection[] = [
  {
    id: "academics",
    label: "Academics",
    icon: <AcademicsIcon />,
    children: [{ label: "My Schedule" }, { label: "My Grades" }, { label: "Enrollment" }],
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
    children: [{ label: "Forms Portal" }, { label: "Track Requests" }],
  },
  {
    id: "settings",
    label: "Settings",
    icon: <GearIcon />,
    children: [
      { label: "Profile", to: "/profile" },
      { label: "Change Password", to: "/change-password" },
      { label: "Logout", kind: "signout" as const },
    ],
  },
  // The same support address as the sign-in page.
  { id: "help", label: "Help & Support", icon: <HelpIcon />, href: "mailto:icto-admin@pup.edu.ph" },
];

const SIDEBAR_ID = "student-sidebar";

// ---- Component ----

/**
 * The student portal's frame: a white header (seal, name, the main links), the collapsible
 * obelisk sidebar (a drawer below 768px), and the main landmark the skip link jumps to.
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
  const [openSection, setOpenSection] = useState<string | null>(null);

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
      <header className="border-brand-border/30 z-20 flex h-[72px] shrink-0 items-center justify-between gap-4 border-b bg-white px-4 md:px-8">
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
              <span className="text-brand-maroon block text-xs leading-tight font-medium">
                PUP Academic Portal
              </span>
            </span>
          </Link>
        </div>

        <nav aria-label="Main" className="hidden items-center sm:flex print:hidden">
          {/* Notifications: not built yet — unavailable, never a dead link. */}
          <span
            role="link"
            aria-disabled="true"
            title="Coming soon"
            className="text-brand-ink inline-flex min-h-11 cursor-default items-center text-sm font-medium"
          >
            Notifications
            <span className="sr-only">, coming soon</span>
          </span>
        </nav>
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
          <nav
            aria-label="Student modules"
            className="flex-1 overflow-x-hidden overflow-y-auto py-2"
          >
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
                  open ? "bg-white/10 text-white" : ""
                }`;
                return (
                  <li key={section.id}>
                    {section.href ? (
                      <a
                        href={section.href}
                        className={rowClass}
                        aria-label={`${section.label}: email portal support`}
                      >
                        {section.icon}
                        {expanded && (
                          <span className="flex-1 text-left text-sm font-medium whitespace-nowrap">
                            {section.label}
                          </span>
                        )}
                      </a>
                    ) : (
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
                    )}

                    {/* Submenu */}
                    {open && section.children && (
                      <ul className="bg-black/15">
                        {section.children.map((item) => (
                          <li key={item.label}>
                            {item.kind === "signout" ? (
                              <SignOutButton className={subItem}>{item.label}</SignOutButton>
                            ) : item.to ? (
                              <Link to={item.to} className={subItem}>
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
          </nav>

          <ProfileCard expanded={expanded} />
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
 * Who is signed in, and Sign out (with its confirmation). The name shows only once the API
 * gives one; it is never derived from the email.
 */
function ProfileCard({ expanded }: { expanded: boolean }) {
  const me = useMe();
  const name = useStudentName();
  const fullName = name.data?.fullName;

  return (
    <div className="shrink-0 border-t border-white/15 p-3">
      <div className={`flex items-center ${expanded ? "gap-3" : "flex-col gap-2"}`}>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
          <UserCircleIcon />
        </div>
        {me.isPending && <p className="sr-only">Loading your account</p>}
        {me.isSuccess && <p className="sr-only">Signed in as {me.data.email}</p>}
        {expanded && (
          <div className="min-w-0 flex-1" aria-hidden="true">
            <p className="truncate text-xs leading-tight font-semibold text-white">
              {(fullName ?? "Student").toUpperCase()}
            </p>
            {me.isSuccess && (
              <p className="truncate text-xs leading-tight text-white/80">{me.data.email}</p>
            )}
          </div>
        )}
        <SignOutButton className="focus-visible:outline-brand-gold! grid size-11 shrink-0 place-items-center rounded-lg text-white hover:bg-white/10">
          <SignOutIcon />
          <span className="sr-only">Sign out</span>
        </SignOutButton>
      </div>
    </div>
  );
}
