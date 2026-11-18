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
      path: "/catalog",
      beforeLoad: () => {
        if (!session.isSignedIn()) throw redirect({ to: "/" });
      },
      component: lazyRouteComponent(() => import("./CatalogPage"), "CatalogPage"),
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/catalog/courses",
      beforeLoad: () => {
        if (!session.isSignedIn()) throw redirect({ to: "/" });
      },
      component: lazyRouteComponent(() => import("./CatalogPage"), "CatalogCoursesRoute"),
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/catalog/sections",
      beforeLoad: () => {
        if (!session.isSignedIn()) throw redirect({ to: "/" });
      },
      component: lazyRouteComponent(() => import("./CatalogPage"), "CatalogSectionsRoute"),
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/catalog/curricula",
      beforeLoad: () => {
        if (!session.isSignedIn()) throw redirect({ to: "/" });
      },
      component: lazyRouteComponent(() => import("./CatalogPage"), "CatalogCurriculaRoute"),
    }),
  ];
}
