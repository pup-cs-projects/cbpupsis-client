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
      path: "/users",
      beforeLoad: () => {
        if (!session.isSignedIn()) throw redirect({ to: "/" });
      },
      component: lazyRouteComponent(() => import("./UserManagementPage"), "UserManagementPage"),
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/users/students",
      beforeLoad: () => {
        if (!session.isSignedIn()) throw redirect({ to: "/" });
      },
      component: lazyRouteComponent(
        () => import("./PeopleManagementPage"),
        "StudentManagementPage",
      ),
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/users/faculty",
      beforeLoad: () => {
        if (!session.isSignedIn()) throw redirect({ to: "/" });
      },
      component: lazyRouteComponent(
        () => import("./PeopleManagementPage"),
        "FacultyManagementPage",
      ),
    }),
  ];
}
