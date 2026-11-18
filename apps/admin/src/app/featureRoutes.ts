import type { AnyRootRoute, AnyRoute } from "@tanstack/react-router";
type Feature = { default: (root: AnyRootRoute) => AnyRoute[] };
const modules = import.meta.glob<Feature>("../features/*/portalRoutes.tsx", { eager: true });
/** Each feature supplies its routes without sharing a registration edit with other stories. */
export function featureRoutes(root: AnyRootRoute): AnyRoute[] {
  return Object.keys(modules)
    .sort()
    .flatMap((key) => modules[key]!.default(root));
}
