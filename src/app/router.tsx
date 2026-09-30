import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "./routes/__root";
import { indexRoute } from "./routes/index";
import { projectRoute } from "./routes/projects/$projectId";
import { candidateRoute } from "./routes/projects/$projectId.candidates";
import { comparisonRoute } from "./routes/projects/$projectId.compare";
import { finalizationRoute } from "./routes/projects/$projectId.finalize";
import { generationRoute } from "./routes/projects/$projectId.generate";
import { onboardingRoute } from "./routes/projects/new/$step";
import { backupRoute } from "./routes/projects/$projectId.backup";
import { recoveryRoute } from "./routes/recovery";

const routeTree = rootRoute.addChildren([
  indexRoute,
  onboardingRoute,
  projectRoute,
  generationRoute,
  candidateRoute,
  comparisonRoute,
  finalizationRoute,
  backupRoute,
  recoveryRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
