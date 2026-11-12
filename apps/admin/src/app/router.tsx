import { createPortalRouter } from "@cbpupsis/account";
import { MaintenancePage, NotFoundPage, ServerErrorPage } from "@cbpupsis/ui";
import { createRoute, redirect, type RouterHistory } from "@tanstack/react-router";

import { AdminDashboard } from "../features/dashboard/AdminDashboard";
import { AdminLoginPage } from "../features/sign-in/AdminLoginPage";
import { EnrollmentRequestsPage } from "../features/enrollment-requests/EnrollmentRequestsPage";
import { account, session } from "../lib/auth";
import { IncompleteCompletionsPage } from "../features/incomplete-completions/IncompleteCompletionsPage";

/** Tests pass a memory history; the app uses the browser's. */
export function createAppRouter(history?: RouterHistory) {
  return createPortalRouter({
    config: account,
    signIn: AdminLoginPage,
    dashboard: AdminDashboard,
    statusPages: {
      notFound: NotFoundPage,
      serverError: ServerErrorPage,
      maintenance: MaintenancePage,
    },
    extraRoutes: (rootRoute) => [
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/incomplete-completions",
        beforeLoad: () => {
          if (!session.isSignedIn()) throw redirect({ to: "/" });
        },
        component: IncompleteCompletionsPage,
      }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/enrollment-requests",
        beforeLoad: () => {
          if (!session.isSignedIn()) throw redirect({ to: "/" });
        },
        component: EnrollmentRequestsPage,
      }),
    ],
    history,
  });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
