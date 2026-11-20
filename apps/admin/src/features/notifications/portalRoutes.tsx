import { createRoute, redirect, type AnyRootRoute } from "@tanstack/react-router";
import { session } from "../../lib/auth";
import { NotificationsPage } from "./NotificationsPage";
export default function routes(root: AnyRootRoute) {
  return [
    createRoute({
      getParentRoute: () => root,
      path: "/notifications",
      beforeLoad: () => {
        if (!session.isSignedIn()) throw redirect({ to: "/" });
      },
      component: NotificationsPage,
    }),
  ];
}
