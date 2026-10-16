import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthError, request } from "../../lib/auth-api";
import type { AdminSession } from "./types";
import { adminSessionKey } from "./useAdminAuth";
import { useCountdown } from "./useCountdown";
import { AuthSkeleton } from "./AuthSkeleton";

const sections = [
  {
    id: "students",
    title: "Student records",
    permission: "students:read",
    path: "/admin/students",
  },
  { id: "audit", title: "Audit ledger", permission: "audit:read", path: "/admin/audit" },
] as const;
export function AccessError({ error }: { error: Error }) {
  const code = error instanceof AuthError ? error.code : "";
  return (
    <div className="auth-error" role="alert">
      <h2>
        {code === "RESOURCE_NOT_FOUND"
          ? "Record not found"
          : code === "AUTH_INSUFFICIENT_ROLE"
            ? "Action unavailable for your role"
            : code === "AUTH_MFA_ENROLLMENT_REQUIRED"
              ? "Second factor setup required"
              : "Unable to load this page"}
      </h2>
      <p>
        {code === "RESOURCE_NOT_FOUND"
          ? "Check the link or return to your dashboard."
          : code === "AUTH_INSUFFICIENT_ROLE"
            ? "Contact ICTO or your system administrator if you need access."
            : code === "AUTH_MFA_ENROLLMENT_REQUIRED"
              ? "Return to sign in and complete your authenticator setup."
              : "Please try again. If the problem continues, contact ICTO."}
      </p>
      {error instanceof AuthError && error.requestId && (
        <p className="request-id">Reference: {error.requestId}</p>
      )}
    </div>
  );
}
function SectionContent({
  section,
  session,
}: {
  section: (typeof sections)[number];
  session: AdminSession;
}) {
  const query = useQuery({
    queryKey: ["admin", session.position, section.id],
    queryFn: () =>
      request(section.path + "?page=1&page_size=25", undefined, session.accessToken, "GET"),
    retry: false,
    gcTime: 0,
  });
  if (query.isPending) return <AuthSkeleton />;
  if (query.error)
    return (
      <>
        <AccessError error={query.error} />
        <button className="secondary-button" onClick={() => void query.refetch()}>
          Try again
        </button>
      </>
    );
  const items = query.data.items;
  if (!Array.isArray(items)) return <AccessError error={new AuthError("INVALID_RESPONSE")} />;
  if (!items.length) return <p role="status">No {section.title.toLowerCase()} to display.</p>;
  return (
    <p role="status">
      {items.length} entries available. The detailed {section.title.toLowerCase()} view is not
      available yet.
    </p>
  );
}
export function AdminDashboard({ sectionId }: { sectionId?: string }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: session } = useQuery<AdminSession>({ queryKey: adminSessionKey, enabled: false });
  const remaining = useCountdown(session?.expiresAt);
  if (!session || session.role !== "admin" || remaining === 0) return <Navigate to="/" replace />;
  const allowed = sections.filter((item) => session.permissions.includes(item.permission));
  const section = allowed.find((item) => item.id === sectionId);
  return (
    <div className="dashboard">
      <a className="skip-link" href="#dashboard-main">
        Skip to content
      </a>
      <header className="dashboard-header">
        <strong>CBPUPSIS · Admin Portal</strong>
        <button
          className="secondary-button"
          onClick={() => {
            client.clear();
            void navigate({ to: "/" });
          }}
        >
          Lock this screen
        </button>
      </header>
      <div className="dashboard-layout">
        <aside>
          <button
            className="secondary-button menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="admin-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            Menu
          </button>
          <nav
            id="admin-navigation"
            className={menuOpen ? "admin-navigation is-open" : "admin-navigation"}
            aria-label="Administrative functions"
          >
            <Link to="/dashboard">Overview</Link>
            {allowed.map((item) => (
              <Link key={item.id} to="/dashboard/$section" params={{ section: item.id }}>
                {item.title}
              </Link>
            ))}
          </nav>
        </aside>
        <main id="dashboard-main" tabIndex={-1}>
          <nav aria-label="Breadcrumb">
            <Link to="/dashboard">Dashboard</Link>
            {section && ` / ${section.title}`}
          </nav>
          <h1>
            {sectionId ? (section?.title ?? "Access unavailable") : "Administrative dashboard"}
          </h1>
          <p>Signed in as {session.position}.</p>
          {sectionId ? (
            section ? (
              <SectionContent key={section.id} section={section} session={session} />
            ) : (
              <AccessError error={new AuthError("AUTH_INSUFFICIENT_ROLE")} />
            )
          ) : (
            <section className="dashboard-panel">
              <h2>Welcome to your Admin Portal</h2>
              <p>
                {allowed.length
                  ? "Choose a function from the menu to get started."
                  : "No administrative functions are available for this account. Contact ICTO for assistance."}
              </p>
              <p>Administrative actions are recorded in the audit ledger.</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
