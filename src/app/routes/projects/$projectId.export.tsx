import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../__root";

export const selectedExportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId/export",
  component: lazyRouteComponent(
    () => import("./$projectId.export.view"),
    "SelectedExportRoute",
  ),
});
