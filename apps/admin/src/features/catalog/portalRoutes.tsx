import { createRoute, redirect, type AnyRootRoute } from "@tanstack/react-router";

import { session } from "../../lib/auth";
import { CatalogPage } from "./CatalogPage";

export default function catalogRoutes(root: AnyRootRoute) {
  return [
    createRoute({
      getParentRoute: () => root,
      path: "/catalog",
      beforeLoad: () => {
        if (!session.isSignedIn()) throw redirect({ to: "/" });
      },
      component: CatalogPage,
    }),
  ];
}
