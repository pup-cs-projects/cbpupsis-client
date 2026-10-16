import { Outlet } from "@tanstack/react-router";

import { AccountContext, type AccountConfig } from "../context";
import { IdleWarning } from "../session/IdleWarning";
import { SessionWatcher } from "../session/SessionWatcher";
import { useIdleTimeout } from "../session/useIdleTimeout";

/**
 * The root of every page: the portal's account config for the screens below, session
 * redirects, and the idle warning over an inert page.
 */
export function AppFrame({ config }: { config: AccountConfig }) {
  return (
    <AccountContext value={config}>
      <Frame />
    </AccountContext>
  );
}

function Frame() {
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
