import { errorMessage } from "@cbpupsis/shared/api";
import { Link } from "@tanstack/react-router";
import { useId, useRef, useState, type KeyboardEvent } from "react";

import { DashboardLayout } from "../dashboard/DashboardLayout";
import { useMe } from "../sign-in/useAdminAuth";
import { button, canEditCatalog, card, isCatalogRole, SCOPE_TEXT } from "./catalogUi";
import { CoursesTab } from "./CoursesTab";
import { CurriculaTab } from "./CurriculaTab";
import { catalogSource, type CatalogDataSource } from "./dataSource";
import { SectionsTab } from "./SectionsTab";
import { SubstitutionsTab } from "./SubstitutionsTab";

const TABS = ["Courses", "Curricula", "Sections", "Substitutions"] as const;
type Tab = (typeof TABS)[number];

/**
 * The shared admin catalog (US-ENRL-005). Chairs edit their department; Deans and the
 * Registrar read. Hiding controls is UX only: the API scopes and refuses every call.
 */
export function CatalogPage({ dataSource = catalogSource }: { dataSource?: CatalogDataSource }) {
  const me = useMe();
  const [tab, setTab] = useState<Tab>("Courses");
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const id = useId();
  const role = me.data?.position;
  const allowed = isCatalogRole(role);
  const editor = isCatalogRole(role) && canEditCatalog(role);

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const index = TABS.indexOf(tab);
    const next =
      event.key === "ArrowRight"
        ? TABS[(index + 1) % TABS.length]
        : event.key === "ArrowLeft"
          ? TABS[(index - 1 + TABS.length) % TABS.length]
          : event.key === "Home"
            ? TABS[0]
            : event.key === "End"
              ? TABS[TABS.length - 1]
              : undefined;
    if (!next) return;
    event.preventDefault();
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 px-4 py-8 sm:px-8">
        <header>
          <nav aria-label="Breadcrumb">
            <ol className="text-brand-muted flex flex-wrap gap-1 text-sm">
              <li>
                <Link to="/dashboard" className="underline">
                  Dashboard
                </Link>
                <span aria-hidden="true"> / </span>
              </li>
              <li>Academics</li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">Catalog</li>
            </ol>
          </nav>
          <h1 className="text-brand-maroon mt-2 text-3xl font-bold break-words">
            {editor ? "Manage Course Catalog" : "Course Catalog"}
          </h1>
          <p className="text-brand-muted mt-2 max-w-2xl text-sm leading-relaxed">
            {isCatalogRole(role)
              ? SCOPE_TEXT[role]
              : "Courses, curriculum versions, sections, and substitutions."}
          </p>
        </header>

        {me.isPending ? (
          <p role="status">Checking your account…</p>
        ) : me.isError ? (
          <div role="alert" className={card}>
            <p>Your account could not be loaded. {errorMessage(me.error)}</p>
            <button type="button" className={button + " mt-4"} onClick={() => void me.refetch()}>
              Retry account
            </button>
          </div>
        ) : !allowed ? (
          <section className={card}>
            <p role="alert">This page is not available to your role.</p>
            <Link to="/dashboard" className={button + " mt-4"}>
              Back to dashboard
            </Link>
          </section>
        ) : (
          <div
            key={`${me.data.id}:${me.data.position}:${me.data.departmentId}:${me.data.collegeId}`}
          >
            <div
              role="tablist"
              aria-label="Catalog sections"
              className="border-brand-border/30 flex gap-1 overflow-x-auto border-b"
            >
              {TABS.map((name) => (
                <button
                  key={name}
                  ref={(node) => {
                    tabRefs.current[name] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`${id}-tab-${name}`}
                  aria-selected={tab === name}
                  aria-controls={`${id}-panel-${name}`}
                  tabIndex={tab === name ? 0 : -1}
                  onClick={() => setTab(name)}
                  onKeyDown={onTabKey}
                  className={
                    "min-h-11 shrink-0 cursor-pointer border-b-4 px-4 py-2 text-sm font-semibold focus-visible:outline-offset-0! " +
                    (tab === name
                      ? "border-brand-maroon text-brand-maroon"
                      : "text-brand-muted hover:text-brand-ink border-transparent")
                  }
                >
                  {name}
                </button>
              ))}
            </div>
            <div
              role="tabpanel"
              id={`${id}-panel-${tab}`}
              aria-labelledby={`${id}-tab-${tab}`}
              tabIndex={0}
              className="pt-6 focus-visible:outline-offset-4"
            >
              {tab === "Courses" ? (
                <CoursesTab source={dataSource} adminId={me.data.id} editor={editor} />
              ) : tab === "Curricula" ? (
                <CurriculaTab source={dataSource} adminId={me.data.id} editor={editor} />
              ) : tab === "Sections" ? (
                <SectionsTab source={dataSource} adminId={me.data.id} editor={editor} />
              ) : (
                <SubstitutionsTab source={dataSource} adminId={me.data.id} editor={editor} />
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
