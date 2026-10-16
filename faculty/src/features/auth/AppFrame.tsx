import { Outlet } from "@tanstack/react-router";

import { IdleWarning } from "./IdleWarning";
import { SessionWatcher } from "./SessionWatcher";
import { useIdleTimeout } from "./useIdleTimeout";

/** The root of every page: session redirects, and the idle warning over an inert page. */
export function AppFrame() {
  const { endsAt, stay, signOut, returnFocus } = useIdleTimeout();
  const warning = endsAt !== null;
  return (
    <>
      <SessionWatcher />
      <div className="app-frame" inert={warning || undefined}>
        <Outlet />
      </div>
      {warning && (
        <IdleWarning
          endsAt={endsAt}
          staying={stay.isPending}
          stayError={stay.error}
          signingOut={signOut.isPending}
          returnFocus={returnFocus}
          onStay={() => stay.mutate()}
          onSignOut={() => signOut.mutate()}
        />
      )}
    </>
  );
}
