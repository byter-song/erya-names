import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../__root";

export const generationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId/generate",
  component: lazyRouteComponent(() => import("./$projectId.generate.view"), "GenerationRoute"),
});
