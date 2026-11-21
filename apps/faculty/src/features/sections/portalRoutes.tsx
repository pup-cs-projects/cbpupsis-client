import { createRoute, redirect, type AnyRootRoute } from "@tanstack/react-router";
import { session } from "../../lib/auth";
import { RosterPage } from "../roster/RosterPage";
import { SectionsPage } from "./SectionsPage";
export default function sectionRoutes(root: AnyRootRoute) {
  const beforeLoad = () => {
    if (!session.isSignedIn()) throw redirect({ to: "/" });
  };
  const roster = createRoute({
    getParentRoute: () => root,
    path: "/sections/$sectionId/roster",
    beforeLoad,
    component: () => <RosterPage sectionId={roster.useParams().sectionId} />,
  });
  return [
    createRoute({
      getParentRoute: () => root,
      path: "/sections",
      beforeLoad,
      component: SectionsPage,
    }),
    roster,
  ];
}
