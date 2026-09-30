import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "./__root";

export const recoveryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/recovery",
  component: lazyRouteComponent(() => import("./recovery.view"), "RecoveryRoute"),
});
