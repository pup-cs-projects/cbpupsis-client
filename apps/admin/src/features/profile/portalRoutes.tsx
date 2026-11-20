import { createRoute, redirect, type AnyRootRoute } from "@tanstack/react-router";
import { session } from "../../lib/auth";
import { ProfilePage } from "./ProfilePage";
export default function routes(root: AnyRootRoute) {
  return [
    createRoute({
      getParentRoute: () => root,
      path: "/profile",
      beforeLoad: () => {
        if (!session.isSignedIn()) throw redirect({ to: "/" });
      },
      component: ProfilePage,
    }),
  ];
}
