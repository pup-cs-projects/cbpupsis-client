import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  type RouteComponent,
  type RouterHistory,
} from "@tanstack/react-router";

import type { AccountConfig } from "./context";
import { AppFrame } from "./layout/AppFrame";
import { ChangePasswordPage } from "./password/ChangePasswordPage";
import { ForgotPasswordPage } from "./password/ForgotPasswordPage";
import { ResetPasswordPage } from "./password/ResetPasswordPage";

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
  /** Tests pass a memory history; the app uses the browser's. */
  history?: RouterHistory;
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
  history,
}: PortalRouterOptions) {
  const { session } = config;

  const rootRoute = createRootRoute({
    component: () => <AppFrame config={config} />,
    notFoundComponent: notFound,
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
  ]);

  return createRouter({ routeTree, history });
}
