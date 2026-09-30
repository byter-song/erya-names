import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../../__root";

export const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/new/$step",
  component: lazyRouteComponent(() => import("./$step.view"), "OnboardingPlaceholder"),
});
