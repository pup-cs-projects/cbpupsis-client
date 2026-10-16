import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";

import { SessionWatcher } from "../features/auth/SessionWatcher";
import { AdminDashboard } from "../features/auth/AdminDashboard";
import { AdminLoginPage } from "../features/auth/AdminLoginPage";
import { session } from "../lib/auth";

const rootRoute = createRootRoute({
  component: () => (
    <>
      <SessionWatcher />
      <Outlet />
    </>
  ),
  notFoundComponent: () => (
    <main className="dashboard">
      <h1>Page not found</h1>
      <p>Check the address or return to sign in.</p>
      <a href="/">Return to sign in</a>
    </main>
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
  component: AdminLoginPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  beforeLoad: () => {
    if (!session.isSignedIn()) throw redirect({ to: "/" });
  },
  component: AdminDashboard,
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
