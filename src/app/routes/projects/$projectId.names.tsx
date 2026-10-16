import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../__root";

export const namesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId/names",
  component: lazyRouteComponent(() => import("./$projectId.names.view"), "NamesRoute"),
});
