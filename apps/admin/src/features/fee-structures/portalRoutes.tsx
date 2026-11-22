import { createRoute, redirect, type AnyRootRoute } from "@tanstack/react-router";
import { session } from "../../lib/auth";
import { FeeStructuresPage } from "./FeeStructuresPage";
export default function feeStructureRoutes(root: AnyRootRoute) {
  return [
    createRoute({
      getParentRoute: () => root,
      path: "/fee-structures",
      beforeLoad: () => {
        if (!session.isSignedIn()) throw redirect({ to: "/" });
      },
      component: FeeStructuresPage,
    }),
  ];
}
