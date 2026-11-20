import { createPortalRouter } from "@cbpupsis/account";
import { createRoute, redirect, useParams, type RouterHistory } from "@tanstack/react-router";

import { AccountPage } from "../features/account/AccountPage";
import { PayCancelReturn, PayPage, PaySuccessReturn } from "../features/account/PayPage";
import { HomePage } from "../features/dashboard/HomePage";
import { AddDropPage } from "../features/enrollment/AddDropPage";
import { CertificatePage } from "../features/enrollment/CertificatePage";
import { EnrollmentPage } from "../features/enrollment/EnrollmentPage";
import { GradesPage } from "../features/grades/GradesPage";
import { ProfilePage } from "../features/profile/ProfilePage";
import { GoogleCalendarCallbackPage } from "../features/schedule/GoogleCalendarCallbackPage";
import { SchedulePage } from "../features/schedule/SchedulePage";
import { SignInPage } from "../features/sign-in/SignInPage";
import { VerifyCertificatePage } from "../features/verify/VerifyCertificatePage";
import { account } from "../lib/auth";

/** Tests pass a memory history; the app uses the browser's. */
export function createAppRouter(history?: RouterHistory) {
  return createPortalRouter({
    config: account,
    signIn: SignInPage,
    dashboard: HomePage,
    history,
    extraRoutes: (rootRoute) => [
      // Public handoff page: it scrubs OAuth parameters and explains an expired SIS session.
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/calendar/google/callback",
        component: GoogleCalendarCallbackPage,
      }),
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
        path: "/account",
        beforeLoad: () => {
          if (!account.session.isSignedIn()) throw redirect({ to: "/" });
        },
        component: AccountPage,
      }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/account/pay",
        beforeLoad: () => {
          if (!account.session.isSignedIn()) throw redirect({ to: "/" });
        },
        component: PayPage,
      }),
      // Where the payment gateway sends the student back to (the API's XENDIT_SUCCESS_RETURN_URL
      // and XENDIT_CANCEL_RETURN_URL, http://localhost:3000/payments/success and /cancel in
      // development). A student whose session ended on the trip signs in first.
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/payments/success",
        beforeLoad: () => {
          if (!account.session.isSignedIn()) throw redirect({ to: "/" });
        },
        component: PaySuccessReturn,
      }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/payments/cancel",
        beforeLoad: () => {
          if (!account.session.isSignedIn()) throw redirect({ to: "/" });
        },
        component: PayCancelReturn,
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
        path: "/enrollment/add-drop",
        beforeLoad: () => {
          if (!account.session.isSignedIn()) throw redirect({ to: "/" });
        },
        component: AddDropPage,
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
        component: CertificatePage,
      }),
      // Public: anyone checks a printed certificate by its token, signed in or not.
      createRoute({
        getParentRoute: () => rootRoute,
        path: "/verify/$token",
        component: function VerifyRoute() {
          const { token } = useParams({ strict: false });
          return <VerifyCertificatePage token={token ?? ""} />;
        },
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
