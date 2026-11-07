import { createPortalRouter } from "@cbpupsis/account";
import { createRoute, redirect, type RouterHistory } from "@tanstack/react-router";

import { HomePage } from "../features/dashboard/HomePage";
import { CertificateOfRegistration } from "../features/enrollment/CertificateOfRegistration";
import { AddDropPage } from "../features/enrollment/AddDropPage";
import { EnrollmentPage } from "../features/enrollment/EnrollmentPage";
import { GradesPage } from "../features/grades/GradesPage";
import { ProfilePage } from "../features/profile/ProfilePage";
import { SchedulePage } from "../features/schedule/SchedulePage";
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
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/schedule",
        beforeLoad: () => {
          if (!account.session.isSignedIn()) throw redirect({ to: "/" });
        },
        component: SchedulePage,
      }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/grades",
        beforeLoad: () => {
          if (!account.session.isSignedIn()) throw redirect({ to: "/" });
        },
        component: GradesPage,
      }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/enrollment",
        beforeLoad: () => {
          if (!account.session.isSignedIn()) throw redirect({ to: "/" });
        },
        component: EnrollmentPage,
      }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/enrollment/certificate",
        beforeLoad: () => {
          if (!account.session.isSignedIn()) throw redirect({ to: "/" });
        },
        component: CertificateOfRegistration,
      }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/enrollment/add-drop",
        beforeLoad: () => {
          if (!account.session.isSignedIn()) throw redirect({ to: "/" });
        },
        component: AddDropPage,
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
