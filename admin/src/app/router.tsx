import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";

import { AdminDashboard } from "../features/auth/AdminDashboard";
import { AdminLoginPage } from "../features/auth/AdminLoginPage";
import { AppFrame } from "../features/auth/AppFrame";
import { ChangePasswordPage } from "../features/auth/ChangePasswordPage";
import { ForgotPasswordPage } from "../features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "../features/auth/ResetPasswordPage";
import { session } from "../lib/auth";

const rootRoute = createRootRoute({
  component: AppFrame,
  notFoundComponent: () => (
    <main className="dashboard">
      <h1>Page not found</h1>
      <p>Check the address or return to sign in.</p>
      <a href="/">Return to sign in</a>
    </main>
  ),
});

/** Why sign-in is showing: the session ended (`expired`), or a reset just finished. */
export interface SignInSearch {
  expired?: true | "idle";
  notice?: "password-reset";
}

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
  component: AdminLoginPage,
});

// Public: reachable without a session, from the sign-in page and from the mailed link.
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
  component: ResetPasswordPage,
});

// The API accepts a password change only with the signed-in session.
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
  component: AdminDashboard,
});

const routeTree = rootRoute.addChildren([
  signInRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  changePasswordRoute,
  dashboardRoute,
]);

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
