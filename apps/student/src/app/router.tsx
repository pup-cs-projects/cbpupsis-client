import { createPortalRouter } from "@cbpupsis/account";
import { createRoute, redirect, type RouterHistory } from "@tanstack/react-router";

import { HomePage } from "../features/dashboard/HomePage";
import { ProfilePage } from "../features/profile/ProfilePage";
import { SchedulePage } from "../features/schedule/SchedulePage";
import { SignInPage } from "../features/sign-in/SignInPage";
import { account } from "../lib/auth";

// TEMPORARY (US-STU-003 UI review): in `npm run dev`, `/` opens the schedule without signing in.
// Off in tests and production builds. Remove this and the guard bypass below before merging.
const PREVIEW_SCHEDULE = import.meta.env.DEV && import.meta.env.MODE !== "test";

/** Tests pass a memory history; the app uses the browser's. */
export function createAppRouter(history?: RouterHistory) {
  return createPortalRouter({
    config: account,
    signIn: SignInPage,
    dashboard: HomePage,
    history,
    devBootstrapPath: PREVIEW_SCHEDULE ? "/schedule" : undefined,
    extraRoutes: (rootRoute) => [
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/profile",
        beforeLoad: () => {
          if (!account.session.isSignedIn()) throw redirect({ to: "/" });
        },
        component: ProfilePage,
      }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/schedule",
        beforeLoad: () => {
          if (!PREVIEW_SCHEDULE && !account.session.isSignedIn()) throw redirect({ to: "/" });
        },
        component: SchedulePage,
      }),
    ],
  });
}

export const router = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
