import { createRoute, redirect, type AnyRootRoute } from "@tanstack/react-router";
import { session } from "../../lib/auth";
import { GradeSectionsPage } from "./GradeSectionsPage";
import { GradesPage } from "./GradesPage";
import { IncompletesPage } from "../incompletes/IncompletesPage";
export default function gradingRoutes(rootRoute: AnyRootRoute) {
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
}
