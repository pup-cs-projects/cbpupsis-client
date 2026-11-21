import { createPortalRouter } from "@cbpupsis/account";
import { MaintenancePage, NotFoundPage, ServerErrorPage } from "@cbpupsis/ui";
import type { RouterHistory } from "@tanstack/react-router";

import { AdminDashboard } from "../features/dashboard/AdminDashboard";
import { AdminLoginPage } from "../features/sign-in/AdminLoginPage";
import { account } from "../lib/auth";

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
    history,
  });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
