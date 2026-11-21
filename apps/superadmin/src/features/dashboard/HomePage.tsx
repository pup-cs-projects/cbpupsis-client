import { SignOutButton } from "@cbpupsis/account";
import { NOTICES } from "@cbpupsis/shared/auth";
import { AuthSkeleton, ErrorAlert, Notice } from "@cbpupsis/ui";
import { useSearch } from "@tanstack/react-router";

import { useMe } from "../sign-in/queries";
import "@cbpupsis/account/styles.css";

export function HomePage() {
  const { notice } = useSearch({ strict: false });
  const me = useMe();

  return (
    <div className="dashboard">
      <a className="skip-link" href="#dashboard-main">
        Skip to content
      </a>
      <header className="dashboard-header">
        <strong>CBPUPSIS · Superadmin Portal</strong>
        <SignOutButton className="secondary-button" />
      </header>
      <main id="dashboard-main" tabIndex={-1}>
        <h1>Superadmin dashboard</h1>
        {notice === "password-changed" && <Notice tone="success">{NOTICES.passwordChanged}</Notice>}
        {me.isPending && <AuthSkeleton />}
        {me.isError && <ErrorAlert error={me.error} onRetry={() => void me.refetch()} />}
        {me.isSuccess && <p>Signed in as {me.data.email}</p>}
        <section className="dashboard-panel">
          <h2>Welcome to your Superadmin Portal</h2>
          <p>Every superadmin action is recorded in the audit ledger.</p>
        </section>
      </main>
    </div>
  );
}
