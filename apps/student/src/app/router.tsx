import { createPortalRouter } from "@cbpupsis/account";
import { createRoute, redirect, type RouterHistory } from "@tanstack/react-router";

import { HomePage } from "../features/dashboard/HomePage";
import { ProfilePage } from "../features/profile/ProfilePage";
import { SignInPage } from "../features/sign-in/SignInPage";
import { account } from "../lib/auth";

/** Tests pass a memory history; the app uses the browser's. */
export function createAppRouter(history?: RouterHistory) {
  return createPortalRouter({
    config: account,
    signIn: SignInPage,
    dashboard: HomePage,
    history,
    extraRoutes: (rootRoute) => [
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/profile",
        beforeLoad: () => {
          if (!account.session.isSignedIn()) throw redirect({ to: "/" });
        },
        component: ProfilePage,
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
