import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../__root";

export const comparisonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId/compare",
  component: lazyRouteComponent(() => import("./$projectId.compare.view"), "ComparisonRoute"),
});
