import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { FacultyLoginPage } from "../features/auth/FacultyLoginPage";
import { FacultyDashboard } from "../features/auth/FacultyDashboard";

const rootRoute = createRootRoute({ component: Outlet });
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: FacultyLoginPage,
});
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: FacultyDashboard,
});
const routeTree = rootRoute.addChildren([loginRoute, dashboardRoute]);
export const router = createRouter({ routeTree });
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
