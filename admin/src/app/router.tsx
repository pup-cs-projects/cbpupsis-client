import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { AdminLoginPage } from "../features/auth/AdminLoginPage";
import { AdminDashboard } from "../features/auth/AdminDashboard";
const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: () => (
    <main className="dashboard">
      <h1>Page not found</h1>
      <p>Check the address or return to sign in.</p>
      <a href="/">Return to sign in</a>
    </main>
  ),
});
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: AdminLoginPage,
});
const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  component: AdminDashboard,
});
const sectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard/$section",
  component: () => {
    const { section } = sectionRoute.useParams();
    return <AdminDashboard sectionId={section} />;
  },
});
export const router = createRouter({
  routeTree: rootRoute.addChildren([homeRoute, dashboardRoute, sectionRoute]),
});
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
