import { createRoute, redirect, type AnyRootRoute } from "@tanstack/react-router";
import { session } from "../../lib/auth";
import { GradeCorrectionsPage } from "./GradeCorrectionsPage";
export default function correctionRoutes(root: AnyRootRoute) {
  return [
    createRoute({
      getParentRoute: () => root,
      path: "/grade-corrections",
      beforeLoad: () => {
        if (!session.isSignedIn()) throw redirect({ to: "/" });
      },
      component: GradeCorrectionsPage,
    }),
  ];
}
