import { useEffect, useRef, useState, type ReactNode } from "react";

import { DashboardIcon } from "./DashboardIcon";

type NavigationItem = {
  label: string;
  icon: ReactNode;
  children: { label: string; content?: ReactNode }[];
};

/** The student dashboard's frame, with portal-specific navigation and account slots. */
export function DashboardLayout({
  children,
  portal,
  navigation,
  account,
  homeLink,
  headerNavigation,
}: {
  children: ReactNode;
  portal: string;
  headerNavigation?: ReactNode;
  navigation: NavigationItem[];
  account: ReactNode | ((expanded: boolean) => ReactNode);
  homeLink: (className: string, children: ReactNode) => ReactNode;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const expanded = isExpanded || drawerOpen;
  const sidebarId = `${portal.toLowerCase()}-sidebar`;

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebar.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        menuButton.current?.focus();
      }
      if (event.key !== "Tab") return;
      const items = sidebar.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex="0"]',
      );
      if (!items?.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  function closeDrawer() {
    setDrawerOpen(false);
    menuButton.current?.focus();
  }

  const navItem =
    "flex min-h-11 w-full items-center py-3 text-white/90 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-brand-gold! focus-visible:-outline-offset-2!";

  return (
    <div className="text-brand-ink flex h-dvh flex-col overflow-hidden print:block print:h-auto print:overflow-visible">
      <a
        href="#dashboard-main"
        className="focus:text-brand-maroon-dark sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:font-semibold focus:shadow-lg print:hidden"
      >
        Skip to content
      </a>
      <header className="border-brand-border/30 z-20 flex h-[72px] shrink-0 items-center justify-between gap-4 border-b bg-white px-4 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            ref={menuButton}
            type="button"
            className="text-brand-maroon hover:bg-brand-maroon/10 grid size-11 shrink-0 place-items-center rounded-lg md:hidden print:hidden"
            aria-label="Menu"
            aria-expanded={drawerOpen}
            aria-controls={sidebarId}
            onClick={() => setDrawerOpen((open) => !open)}
          >
            <DashboardIcon name="menu" />
          </button>
          {homeLink(
            "flex min-h-11 items-center gap-3 rounded-md",
            <>
              <img
                src="/apple-touch-icon.png"
                alt=""
                width="48"
                height="48"
                className="size-10 shrink-0 md:size-12"
              />
              <span className="text-brand-maroon leading-snug">
                <span className="block text-[22px] leading-none font-bold tracking-tight">
                  CBPUPSIS
                </span>
                <span className="block text-xs leading-tight font-medium">PUP Academic Portal</span>
              </span>
            </>,
          )}
        </div>
        <nav aria-label="Main" className="hidden items-center gap-12 sm:flex print:hidden">
          {homeLink(
            "text-brand-maroon inline-flex min-h-11 items-center text-sm font-medium",
            "Home",
          )}
          {headerNavigation ??
            ["Profile", "Notifications"].map((label) => (
              <span
                key={label}
                role="link"
                aria-disabled="true"
                title="Coming soon"
                className="inline-flex min-h-11 cursor-default items-center text-sm font-medium"
              >
                {label}
                <span className="sr-only">, coming soon</span>
              </span>
            ))}
        </nav>
      </header>
      <div className="relative flex min-h-0 flex-1 overflow-hidden print:block print:overflow-visible">
        {drawerOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            tabIndex={-1}
            className="bg-brand-ink/40 fixed inset-0 z-30 md:hidden"
            onClick={closeDrawer}
          />
        )}
        <aside
          ref={sidebar}
          id={sidebarId}
          aria-label={`${portal} modules`}
          className={`bg-brand-maroon-dark shrink-0 flex-col overflow-hidden bg-cover bg-center transition-all duration-300 motion-reduce:transition-none print:hidden ${drawerOpen ? "fixed inset-y-0 left-0 z-40 flex w-72" : "hidden md:flex"} ${isExpanded ? "md:w-72" : "md:w-16"}`}
          style={{ backgroundImage: "url(/assets/obelisk.webp)" }}
        >
          <nav
            aria-label={`${portal} modules`}
            className="flex-1 overflow-x-hidden overflow-y-auto py-2"
          >
            <button
              type="button"
              className={`${navItem} ${expanded ? "gap-3 px-[18px]" : "justify-center"}`}
              aria-label={expanded ? "Dashboard: collapse menu" : "Expand menu"}
              aria-expanded={expanded}
              aria-controls={sidebarId}
              onClick={() => (drawerOpen ? closeDrawer() : setIsExpanded((value) => !value))}
            >
              <DashboardIcon name="menu" />
              {expanded && <span className="text-sm font-semibold">Dashboard</span>}
            </button>
            <div className="mx-3 my-1.5 border-t border-white/15" />
            <ul>
              {navigation.map((section) => {
                const open = expanded && openSection === section.label;
                const submenuId = `${sidebarId}-${section.label.toLowerCase().replaceAll(" ", "-")}`;
                return (
                  <li key={section.label}>
                    <button
                      type="button"
                      className={`${navItem} ${expanded ? "gap-3 px-[18px]" : "justify-center"} ${open ? "bg-white/10" : ""}`}
                      aria-label={section.label}
                      aria-expanded={open}
                      aria-controls={submenuId}
                      onClick={() => {
                        setIsExpanded(true);
                        setOpenSection(open ? null : section.label);
                      }}
                    >
                      {section.icon}
                      {expanded && (
                        <>
                          <span className="flex-1 text-left text-sm font-medium">
                            {section.label}
                          </span>
                          <span className={open ? "rotate-180" : ""}>
                            <DashboardIcon name="chevron" className="size-3.5" />
                          </span>
                        </>
                      )}
                    </button>
                    {open && (
                      <ul id={submenuId} className="bg-black/15">
                        {section.children.map((item) => (
                          <li key={item.label}>
                            {item.content ?? (
                              <button
                                type="button"
                                aria-disabled="true"
                                className="focus-visible:outline-brand-gold! flex min-h-11 w-full cursor-default items-center gap-2 py-2.5 pr-4 pl-12 text-left text-sm text-white/85 hover:bg-white/10"
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
          <div className="shrink-0 border-t border-white/15 p-3">
            {typeof account === "function" ? account(expanded) : account}
          </div>
        </aside>
        <main
          id="dashboard-main"
          tabIndex={-1}
          inert={drawerOpen}
          className="bg-brand-paper min-w-0 flex-1 overflow-y-auto focus-visible:outline-none! print:overflow-visible print:bg-white"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
