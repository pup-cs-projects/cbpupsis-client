import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  type AnyRootRoute,
  type AnyRoute,
  type RouteComponent,
  type RouterHistory,
} from "@tanstack/react-router";

import type { AccountConfig } from "./context";
import { AppFrame } from "./layout/AppFrame";
import { ChangePasswordPage } from "./password/ChangePasswordPage";
import { ForgotPasswordPage } from "./password/ForgotPasswordPage";
import { ResetPasswordPage } from "./password/ResetPasswordPage";

declare module "@tanstack/history" {
  interface HistoryState {
    /**
     * The API's own sentence for why it ended the session, carried to sign-in in history state
     * rather than the address, so it is never bookmarked, shared, or logged with the URL.
     */
    sessionEndedReason?: string;
  }
}

/** Why sign-in is showing: the session ended (`expired`), or a reset just finished. */
export interface SignInSearch {
  expired?: true | "idle";
  notice?: "password-reset";
}

export interface PortalRouterOptions {
  config: AccountConfig;
  /** The portal's sign-in screen, at `/`. */
  signIn: RouteComponent;
  /** The portal's first screen after sign-in, at `/dashboard`. */
  dashboard: RouteComponent;
  notFound?: RouteComponent;
  /** Opt-in shared status pages; existing portals keep their current routes. */
  statusPages?: {
    notFound: RouteComponent;
    serverError: RouteComponent;
    maintenance: RouteComponent;
  };
  /** Tests pass a memory history; the app uses the browser's. */
  history?: RouterHistory;
  /**
   * Portal-specific routes to append to the shared route tree. Receives the root route so
   * callers can set `getParentRoute` without needing to import it separately.
   */
  extraRoutes?: (rootRoute: AnyRootRoute) => AnyRoute[];
  /**
   * Dev-only: when set, visiting `/` redirects here unconditionally (bypasses sign-in).
   * Ignored in production builds; callers should gate with `import.meta.env.DEV`.
   */
  devBootstrapPath?: string;
}

/**
 * Every portal's routes: its own sign-in and dashboard, and the shared account flows. Forgot
 * and reset are public (reached from sign-in and from the mailed link); the password change
 * and the dashboard need the signed-in session.
 */
export function createPortalRouter({
  config,
  signIn,
  dashboard,
  notFound,
  statusPages,
  history,
  extraRoutes,
  devBootstrapPath,
}: PortalRouterOptions) {
  const { session } = config;

  const rootRoute = createRootRoute({
    component: () => <AppFrame config={config} />,
    notFoundComponent: statusPages?.notFound ?? notFound,
    errorComponent: statusPages?.serverError,
  });

  const signInRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    validateSearch: (search: Record<string, unknown>): SignInSearch => ({
      ...(search.expired === "idle"
        ? { expired: "idle" }
        : search.expired === true || search.expired === "true"
          ? { expired: true }
          : {}),
      ...(search.notice === "password-reset" ? { notice: "password-reset" } : {}),
    }),
    beforeLoad: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (devBootstrapPath) throw redirect({ to: devBootstrapPath as any });
      if (session.isSignedIn()) throw redirect({ to: "/dashboard" });
    },
    component: signIn,
  });

  const forgotPasswordRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/forgot-password",
    component: ForgotPasswordPage,
  });

  const resetPasswordRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/reset-password",
    validateSearch: (search: Record<string, unknown>): { token?: string } =>
      typeof search.token === "string" && search.token ? { token: search.token } : {},
    component: function ResetPasswordRoute() {
      return <ResetPasswordPage token={resetPasswordRoute.useSearch().token} />;
    },
  });

  const changePasswordRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/change-password",
    beforeLoad: () => {
      if (!session.isSignedIn()) throw redirect({ to: "/" });
    },
    component: ChangePasswordPage,
  });

  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dashboard",
    validateSearch: (search: Record<string, unknown>): { notice?: "password-changed" } =>
      search.notice === "password-changed" ? { notice: "password-changed" } : {},
    beforeLoad: () => {
      if (!session.isSignedIn()) throw redirect({ to: "/" });
    },
    component: dashboard,
  });

  const routeTree = rootRoute.addChildren([
    signInRoute,
    forgotPasswordRoute,
    resetPasswordRoute,
    changePasswordRoute,
    dashboardRoute,
    ...(statusPages
      ? [
          createRoute({
            getParentRoute: () => rootRoute,
            path: "/not-found",
            component: statusPages.notFound,
          }),
          createRoute({
            getParentRoute: () => rootRoute,
            path: "/error",
            component: statusPages.serverError,
          }),
          createRoute({
            getParentRoute: () => rootRoute,
            path: "/maintenance",
            component: statusPages.maintenance,
          }),
        ]
      : []),
    ...(extraRoutes ? extraRoutes(rootRoute) : []),
  ]);

  return createRouter({ routeTree, history });
}
