import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../__root";

export const configurationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId/config",
  component: lazyRouteComponent(() => import("./$projectId.config.view"), "ConfigurationRoute"),
});
