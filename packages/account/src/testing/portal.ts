import type { Session } from "@cbpupsis/shared/auth";
import type { AnyRouter } from "@tanstack/react-router";

/** What the shared suites need to know about the portal they run in. */
export interface PortalFixtures {
  session: Session;
  /** Render the whole app, router and guards included, starting at `path`. */
  renderApp: (path?: string) => AnyRouter;
  /** The sign-in heading, which proves a redirect landed on sign-in. */
  PORTAL_HEADING: string;
  ME_ROUTE: string;
  LOGOUT_ROUTE: string;
  REFRESH_ROUTE: string;
  /** The account the API returns for this role. */
  me: Record<string, unknown>;
  /** The text the dashboard shows once the account has loaded. */
  SIGNED_IN_TEXT: string | RegExp;
  /** Start a session as the sign-in steps would, without going through them. */
  signInDirectly: () => void;
  /** The pair a refresh returns for this role. */
  refreshedPair: Record<string, unknown>;
}
