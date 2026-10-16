import { createPortalRouter } from "@cbpupsis/account";
import type { RouterHistory } from "@tanstack/react-router";

import { AdminDashboard } from "../features/dashboard/AdminDashboard";
import { AdminLoginPage } from "../features/sign-in/AdminLoginPage";
import { account } from "../lib/auth";
import { NotFoundPage } from "./NotFoundPage";

/** Tests pass a memory history; the app uses the browser's. */
export function createAppRouter(history?: RouterHistory) {
  return createPortalRouter({
    config: account,
    signIn: AdminLoginPage,
    dashboard: AdminDashboard,
    notFound: NotFoundPage,
    history,
  });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
