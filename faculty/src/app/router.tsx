import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";

import { SessionWatcher } from "../features/auth/SessionWatcher";
import { FacultyDashboard } from "../features/auth/FacultyDashboard";
import { FacultyLoginPage } from "../features/auth/FacultyLoginPage";
import { session } from "../lib/auth";

const rootRoute = createRootRoute({
  component: () => (
    <>
      <SessionWatcher />
      <Outlet />
    </>
  ),
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  validateSearch: (search: Record<string, unknown>): { expired?: true } =>
    search.expired === true || search.expired === "true" ? { expired: true } : {},
  beforeLoad: () => {
    if (session.isSignedIn()) throw redirect({ to: "/dashboard" });
  },
  component: FacultyLoginPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  beforeLoad: () => {
    if (!session.isSignedIn()) throw redirect({ to: "/" });
  },
  component: FacultyDashboard,
});

const routeTree = rootRoute.addChildren([signInRoute, dashboardRoute]);

/** Tests pass a memory history; the app uses the browser's. */
export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
