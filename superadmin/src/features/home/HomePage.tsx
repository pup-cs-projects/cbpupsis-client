import { ErrorAlert } from "../auth/ErrorAlert";
import { useMe, useSignOut } from "../auth/queries";

export function HomePage() {
  const me = useMe();
  const signOut = useSignOut();

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-4 px-4 sm:px-6">
      <p className="text-brand-maroon text-sm font-semibold tracking-wide uppercase">
        CBPUPSIS Superadmin
      </p>
      <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

      {me.isPending && <p role="status">Loading your account…</p>}
      {me.isError && (
        <div className="flex flex-col gap-2">
          <ErrorAlert error={me.error} />
          <button type="button" className="self-start underline" onClick={() => me.refetch()}>
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
