import { createPortalRouter } from "@cbpupsis/account";
import { MaintenancePage, NotFoundPage, ServerErrorPage } from "@cbpupsis/ui";
import { createRoute, redirect, type RouterHistory } from "@tanstack/react-router";

import { FacultyDashboard } from "../features/dashboard/FacultyDashboard";
import { FacultyLoginPage } from "../features/sign-in/FacultyLoginPage";
import { account, session } from "../lib/auth";
import { GradeSectionsPage } from "../features/grades/GradeSectionsPage";
import { GradesPage } from "../features/grades/GradesPage";
import { IncompletesPage } from "../features/incompletes/IncompletesPage";

/** Tests pass a memory history; the app uses the browser's. */
export function createAppRouter(history?: RouterHistory) {
  return createPortalRouter({
    config: account,
    signIn: FacultyLoginPage,
    dashboard: FacultyDashboard,
    statusPages: {
      notFound: NotFoundPage,
      serverError: ServerErrorPage,
      maintenance: MaintenancePage,
    },
    extraRoutes: (rootRoute) => {
      const beforeLoad = () => {
        if (!session.isSignedIn()) throw redirect({ to: "/" });
      };
      const grades = createRoute({
        getParentRoute: () => rootRoute,
        path: "/sections/$sectionId/grades",
        beforeLoad,
        component: function SectionGradesRoute() {
          return <GradesPage sectionId={grades.useParams().sectionId} />;
        },
      });
      return [
        createRoute({
          getParentRoute: () => rootRoute,
          path: "/grades",
          beforeLoad,
          component: GradeSectionsPage,
        }),
        grades,
        createRoute({
          getParentRoute: () => rootRoute,
          path: "/incompletes",
          beforeLoad,
          component: IncompletesPage,
        }),
      ];
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
