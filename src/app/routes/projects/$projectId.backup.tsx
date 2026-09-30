import { createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { rootRoute } from "../__root";

export const backupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId/backup",
  component: lazyRouteComponent(() => import("./$projectId.backup.view"), "BackupRoute"),
});
