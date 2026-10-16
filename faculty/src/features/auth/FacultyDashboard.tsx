import { ApiError, errorMessage } from "@cbpupsis/shared/api";
import { NOTICES } from "@cbpupsis/shared/auth";
import { useSearch } from "@tanstack/react-router";

import { useMe, useSignOut } from "./useFacultyAuth";
import "./auth.css";

export function FacultyDashboard() {
  const { notice } = useSearch({ strict: false });
  const me = useMe();
  const signOut = useSignOut();
  return (
    <main className="min-h-dvh bg-stone-50 px-6 py-16 text-stone-900">
      <div className="mx-auto max-w-4xl">
        <p className="text-brand-maroon mb-3 font-semibold">CBPUPSIS · Faculty Portal</p>
        <h1 className="mb-4 text-3xl font-bold">Faculty dashboard</h1>
        {notice === "password-changed" && (
          <p className="auth-notice" role="status">
            {NOTICES.passwordChanged}
          </p>
        )}
        {me.isPending && <p role="status">Loading your account…</p>}
        {me.isError && (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-red-900">
            <p>{errorMessage(me.error)}</p>
            {me.error instanceof ApiError && me.error.requestId && (
              <p className="mt-1 text-sm">Reference: {me.error.requestId}</p>
            )}
            <button type="button" className="mt-2 underline" onClick={() => me.refetch()}>
              Try again
            </button>
          </div>
        )}
        {me.isSuccess && <p>Signed in as {me.data.email}</p>}
        <section
          className="mt-8 rounded-xl border border-stone-300 bg-white p-6"
          aria-labelledby="dashboard-empty"
        >
          <h2 id="dashboard-empty" className="mb-2 text-xl font-semibold">
            Welcome to your Faculty Portal
          </h2>
          <p>Faculty dashboard content is not available yet.</p>
        </section>
        <button
          type="button"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
          className="border-brand-maroon text-brand-maroon focus-visible:outline-brand-maroon mt-6 min-h-11 rounded-md border px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
