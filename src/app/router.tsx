import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./routes/__root";
import { indexRoute } from "./routes/index";
import { projectRoute } from "./routes/projects/$projectId";
import { configurationRoute } from "./routes/projects/$projectId.config";
import { namesRoute } from "./routes/projects/$projectId.names";
import { selectedExportRoute } from "./routes/projects/$projectId.export";
import { onboardingRoute } from "./routes/projects/new/$step";
import { backupRoute } from "./routes/projects/$projectId.backup";
import { recoveryRoute } from "./routes/recovery";

const routeTree = rootRoute.addChildren([
  indexRoute,
  onboardingRoute,
  projectRoute,
  configurationRoute,
  namesRoute,
  selectedExportRoute,
  backupRoute,
  recoveryRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
