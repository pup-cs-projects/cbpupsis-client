import {
  createRoute,
  lazyRouteComponent,
  redirect,
  type AnyRootRoute,
} from "@tanstack/react-router";
import { session } from "../../lib/auth";
export default function routes(root: AnyRootRoute) {
  return [
    createRoute({
      getParentRoute: () => root,
      path: "/audit",
      beforeLoad: () => {
        if (!session.isSignedIn()) throw redirect({ to: "/" });
      },
      component: lazyRouteComponent(() => import("./AuditPage"), "AuditPage"),
    }),
  ];
}
