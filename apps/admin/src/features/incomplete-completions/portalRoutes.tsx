import { createRoute, redirect, type AnyRootRoute } from "@tanstack/react-router";
import { session } from "../../lib/auth";
import { IncompleteCompletionsPage } from "./IncompleteCompletionsPage";
export default function completionRoutes(root: AnyRootRoute) {
  return [
    createRoute({
      getParentRoute: () => root,
      path: "/incomplete-completions",
      beforeLoad: () => {
        if (!session.isSignedIn()) throw redirect({ to: "/" });
      },
      component: IncompleteCompletionsPage,
    }),
  ];
}
