import { createPortalRouter } from "@cbpupsis/account";
import type { RouterHistory } from "@tanstack/react-router";

import { FacultyDashboard } from "../features/dashboard/FacultyDashboard";
import { FacultyLoginPage } from "../features/sign-in/FacultyLoginPage";
import { account } from "../lib/auth";

/** Tests pass a memory history; the app uses the browser's. */
export function createAppRouter(history?: RouterHistory) {
  return createPortalRouter({
    config: account,
    signIn: FacultyLoginPage,
    dashboard: FacultyDashboard,
    history,
  });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
