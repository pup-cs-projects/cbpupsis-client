import type { ReactNode } from "react";
import { useState } from "react";
import { useSignOut } from "@cbpupsis/account";
import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import { useDashboardUser } from "./useDashboardUser";

// ---- Icons ----

function MenuIcon() {
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
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function AcademicsIcon() {
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
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  );
}

function BriefcaseIcon() {
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
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    </svg>
  );
}

function MailIcon() {
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
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 7l10 7 10-7" />
    </svg>
  );
}

function GearIcon() {
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function HelpIcon() {
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
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
      <circle cx="12" cy="17" r=".5" fill="currentColor" />
    </svg>
  );
}

function UserCircleIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// ---- Data ----

// Items without a `to` have no route yet and render as buttons.
type SubItem = { label: string; to?: LinkProps["to"]; action?: "signout" };

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
      { label: "Profile" },
      { label: "Change Password", to: "/change-password" },
      { label: "Sign out", action: "signout" },
    ],
  },
  {
    id: "help",
    label: "Help & Support",
    icon: <HelpIcon />,
  },
];

// ---- Component ----

export function DashboardLayout({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const signOut = useSignOut();
  const user = useDashboardUser();

  function handleSectionClick(id: string) {
    if (!isExpanded) {
      setIsExpanded(true);
      setOpenSection(id);
    } else {
      setOpenSection((prev) => (prev === id ? null : id));
    }
  }

  const navItemBase =
    "w-full flex items-center py-3 text-white/90 hover:text-white hover:bg-white/10 transition-colors duration-150 cursor-pointer";

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ---- Full-width top header ---- */}
      <header className="z-20 flex h-[72px] flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-8">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="PUP seal" className="h-12 w-12 flex-shrink-0" />
          <div className="leading-snug">
            <p className="text-[22px] leading-none font-bold tracking-tight text-[#7B1113]">
              CBPUPSIS
            </p>
            <p className="text-[12px] leading-tight font-medium text-[#7B1113]">
              PUP Academic Portal
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-12">
          <Link
            to="/dashboard"
            className="text-sm font-medium text-gray-800 transition-colors hover:text-[#7B1113]"
          >
            Home
          </Link>
          <button
            type="button"
            className="cursor-pointer text-sm font-medium text-gray-800 transition-colors hover:text-[#7B1113]"
          >
            Profile
          </button>
          <button
            type="button"
            className="cursor-pointer text-sm font-medium text-gray-800 transition-colors hover:text-[#7B1113]"
          >
            Notifications
          </button>
        </nav>
      </header>

      {/* ---- Body row: sidebar + main ---- */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ---- Sidebar ---- */}
        <aside
          className={`flex flex-shrink-0 flex-col overflow-hidden transition-all duration-300 ease-in-out ${
            isExpanded ? "w-72" : "w-16"
          }`}
          style={{
            backgroundImage: "url(/assets/obelisk.webp)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Nav */}
          <nav className="flex-1 overflow-x-hidden overflow-y-auto py-2">
            {/* Dashboard / hamburger toggle */}
            <button
              className={`${navItemBase} ${isExpanded ? "gap-3 px-[18px]" : "justify-center"}`}
              onClick={() => setIsExpanded((v) => !v)}
            >
              <MenuIcon />
              {isExpanded && (
                <span className="text-sm font-semibold whitespace-nowrap">Dashboard</span>
              )}
            </button>

            <div className="mx-3 my-1.5 border-t border-white/15" />

            {/* Section rows */}
            {NAV_SECTIONS.map((section) => (
              <div key={section.id}>
                <button
                  className={`${navItemBase} ${isExpanded ? "gap-3 px-[18px]" : "justify-center"} ${
                    openSection === section.id && isExpanded ? "bg-white/10 text-white" : ""
                  }`}
                  onClick={() => handleSectionClick(section.id)}
                >
                  {section.icon}
                  {isExpanded && (
                    <>
                      <span className="flex-1 text-left text-sm font-medium whitespace-nowrap">
                        {section.label}
                      </span>
                      {section.children && (
                        <span
                          className={`transition-transform duration-200 ${
                            openSection === section.id ? "rotate-180" : ""
                          }`}
                        >
                          <ChevronDownIcon />
                        </span>
                      )}
                    </>
                  )}
                </button>

                {/* Submenu */}
                {isExpanded && openSection === section.id && section.children && (
                  <ul className="bg-black/15">
                    {section.children.map((item) =>
                      item.action === "signout" ? (
                        <li key={item.label}>
                          <button
                            className="w-full py-2.5 pr-4 pl-12 text-left text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                            disabled={signOut.isPending}
                            onClick={() => signOut.mutate()}
                          >
                            {item.label}
                          </button>
                        </li>
                      ) : item.to ? (
                        <li key={item.label}>
                          <Link
                            to={item.to}
                            className="block py-2.5 pr-4 pl-12 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            {item.label}
                          </Link>
                        </li>
                      ) : (
                        <li key={item.label}>
                          <button
                            type="button"
                            className="w-full cursor-pointer py-2.5 pr-4 pl-12 text-left text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            {item.label}
                          </button>
                        </li>
                      ),
                    )}
                  </ul>
                )}
              </div>
            ))}
          </nav>

          {/* Bottom profile card */}
          <div className="flex-shrink-0 border-t border-white/15 p-3">
            <div className={`flex items-center ${isExpanded ? "gap-3" : "justify-center"}`}>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
                <UserCircleIcon />
              </div>
              {isExpanded && (
                <div className="min-w-0">
                  <p className="truncate text-xs leading-tight font-semibold text-white">
                    {user.displayName.toUpperCase()}
                  </p>
                  <p className="truncate text-[11px] leading-tight text-white/60">
                    {user.studentNumber ?? user.email ?? "—"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ---- Main content ---- */}
        <main id="dashboard-main" tabIndex={-1} className="flex-1 overflow-y-auto bg-[#FDFBF7]">
          {children}
        </main>
      </div>
    </div>
  );
}
