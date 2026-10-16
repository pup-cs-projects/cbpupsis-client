import { ApiError, errorMessage } from "@cbpupsis/shared/api";

import { useMe, useSignOut } from "../auth/queries";

export function HomePage() {
  const me = useMe();
  const signOut = useSignOut();

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-4 px-4 sm:px-6">
      <p className="text-brand-maroon text-sm font-semibold tracking-wide uppercase">
        Polytechnic University of the Philippines
      </p>
      <h1 className="text-3xl font-bold text-gray-900">CBPUPSIS</h1>

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
      {me.isSuccess && <p className="text-gray-700">Signed in as {me.data.email}</p>}

      <div>
        <button
          type="button"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
          className="border-brand-maroon text-brand-maroon focus-visible:outline-brand-maroon min-h-11 rounded-md border px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
