import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../__root";

export const finalizationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId/finalize",
  component: lazyRouteComponent(
    () => import("./$projectId.finalize.view"),
    "FinalizationRoute",
  ),
});
