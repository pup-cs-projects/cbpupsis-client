import { SignOutButton } from "@cbpupsis/account";
import { NOTICES, type AdminPosition } from "@cbpupsis/shared/auth";
import { AuthSkeleton, ErrorAlert, Notice } from "@cbpupsis/ui";
import { Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";

import { useMe } from "../sign-in/useAdminAuth";

const POSITION_LABELS: Record<AdminPosition, string> = {
  chairperson: "Chairperson",
  dean: "Dean",
  finance: "Finance",
  registrar: "Registrar",
};

export function AdminDashboard() {
  const { notice } = useSearch({ strict: false });
  const me = useMe();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="dashboard">
      <a className="skip-link" href="#dashboard-main">
        Skip to content
      </a>
      <header className="dashboard-header">
        <strong>CBPUPSIS · Admin Portal</strong>
        <SignOutButton className="secondary-button" />
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
          </nav>
        </aside>
        <main id="dashboard-main" tabIndex={-1}>
          <h1>Administrative dashboard</h1>
          {notice === "password-changed" && (
            <Notice tone="success">{NOTICES.passwordChanged}</Notice>
          )}
          {me.isPending && <AuthSkeleton />}
          {me.isError && <ErrorAlert error={me.error} onRetry={() => void me.refetch()} />}
          {me.isSuccess && (
            <p>
              Signed in as {me.data.email} ({POSITION_LABELS[me.data.position]}).
            </p>
          )}
          <section className="dashboard-panel">
            <h2>Welcome to your Admin Portal</h2>
            <p>Administrative functions will appear in the menu as they become available.</p>
            <p>Administrative actions are recorded in the audit ledger.</p>
          </section>
        </main>
      </div>
    </div>
  );
}
