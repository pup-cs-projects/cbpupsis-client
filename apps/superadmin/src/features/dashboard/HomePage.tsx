import { useSignOut } from "@cbpupsis/account";
import { ApiError, errorMessage } from "@cbpupsis/shared/api";
import { NOTICES } from "@cbpupsis/shared/auth";
import { AuthSkeleton } from "@cbpupsis/ui";
import { useSearch } from "@tanstack/react-router";

import { useMe } from "../sign-in/queries";
import "@cbpupsis/account/styles.css";

export function HomePage() {
  const { notice } = useSearch({ strict: false });
  const me = useMe();
  const signOut = useSignOut();

  return (
    <div className="dashboard">
      <a className="skip-link" href="#dashboard-main">
        Skip to content
      </a>
      <header className="dashboard-header">
        <strong>CBPUPSIS · Superadmin Portal</strong>
        <button
          className="secondary-button"
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
        >
          Sign out
        </button>
      </header>
      <main id="dashboard-main" tabIndex={-1}>
        <h1>Superadmin dashboard</h1>
        {notice === "password-changed" && (
          <p className="auth-notice" role="status">
            {NOTICES.passwordChanged}
          </p>
        )}
        {me.isPending && <AuthSkeleton />}
        {me.isError && (
          <div className="auth-error" role="alert">
            <p>{errorMessage(me.error)}</p>
            {me.error instanceof ApiError && me.error.requestId && (
              <p className="request-id">Reference: {me.error.requestId}</p>
            )}
            <button className="secondary-button" onClick={() => void me.refetch()}>
              Try again
            </button>
          </div>
        )}
        {me.isSuccess && <p>Signed in as {me.data.email}</p>}
        <section className="dashboard-panel">
          <h2>Welcome to your Superadmin Portal</h2>
          <p>Every superadmin action is recorded in the audit ledger.</p>
        </section>
      </main>
    </div>
  );
}
