import { useState, type KeyboardEvent } from "react";
import { AdminPage, adminCard } from "../../components/AdminPage";
import { useMe } from "../sign-in/useAdminAuth";
import { CatalogAccess } from "./CatalogAccess";
import { catalogScope } from "./catalogRules";
import { CoursesPanel } from "./CoursesPanel";
import { CurriculumPanel } from "./CurriculumPage";
import { SectionsPanel } from "./SectionsPage";
import { SubstitutionsPanel } from "./SubstitutionsPanel";

const tabs = ["Courses", "Curricula", "Sections", "Substitutions"] as const;
type CatalogTab = (typeof tabs)[number];

export function CatalogPage({ initialTab = "Courses" }: { initialTab?: CatalogTab } = {}) {
  const me = useMe();
  const [tab, setTab] = useState<CatalogTab>(initialTab);
  const canEdit = me.data?.position === "chairperson";
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setTab(tabs[next]);
    document.getElementById(`catalog-tab-${tabs[next]}`)?.focus();
  }
  return (
    <CatalogAccess>
      <AdminPage
        title="Course catalog"
        description="Courses, curriculum versions, sections, and substitutions in your academic scope."
      >
        <div className={adminCard + " flex flex-wrap items-center justify-between gap-3"}>
          <p className="text-sm font-semibold">{catalogScope(me.data)}</p>
          <p className="text-brand-muted text-sm">
            {canEdit ? "You can manage your department's catalog." : "Read-only access"}
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Catalog categories"
          className="admin-tabs border-brand-border/25 grid grid-cols-2 overflow-hidden rounded-xl border bg-white sm:flex"
        >
          {tabs.map((name, index) => (
            <button
              key={name}
              id={`catalog-tab-${name}`}
              type="button"
              role="tab"
              aria-selected={tab === name}
              aria-controls={`catalog-panel-${name}`}
              tabIndex={tab === name ? 0 : -1}
              onClick={() => setTab(name)}
              onKeyDown={(event) => moveTab(event, index)}
              className={`min-h-12 flex-1 cursor-pointer px-4 py-3 text-sm font-semibold focus-visible:-outline-offset-3! ${tab === name ? "bg-brand-maroon text-white" : "text-brand-muted hover:bg-brand-surface"}`}
            >
              {name}
            </button>
          ))}
        </div>
        <section
          id={`catalog-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`catalog-tab-${tab}`}
          tabIndex={0}
          className="min-w-0 space-y-5 rounded-lg focus-visible:outline-offset-0!"
        >
          {tab === "Courses" && <CoursesPanel canEdit={canEdit} />}
          {tab === "Curricula" && <CurriculumPanel canEdit={canEdit} />}
          {tab === "Sections" && <SectionsPanel canEdit={canEdit} />}
          {tab === "Substitutions" && <SubstitutionsPanel canEdit={canEdit} />}
        </section>
      </AdminPage>
    </CatalogAccess>
  );
}

// Keep existing bookmarks on the same shared page.
export function CatalogCoursesRoute() {
  return <CatalogPage initialTab="Courses" />;
}
export function CatalogSectionsRoute() {
  return <CatalogPage initialTab="Sections" />;
}
export function CatalogCurriculaRoute() {
  return <CatalogPage initialTab="Curricula" />;
}
