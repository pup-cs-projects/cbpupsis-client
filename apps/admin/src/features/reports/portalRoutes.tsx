import { createRoute, redirect, type AnyRootRoute } from "@tanstack/react-router";
import { session } from "../../lib/auth";
import { ReportsPage } from "./ReportsPage";

export default function reportRoutes(root: AnyRootRoute) {
  return [
    createRoute({
      getParentRoute: () => root,
      path: "/reports",
      beforeLoad: () => {
        if (!session.isSignedIn()) throw redirect({ to: "/" });
      },
      component: ReportsPage,
    }),
  ];
}
