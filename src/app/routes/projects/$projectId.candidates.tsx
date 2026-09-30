import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "../__root";
// Existing bookmarks keep working; screening now lives in the generation workspace.
export const candidateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId/candidates",
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/projects/$projectId/generate",
      params: { projectId: params.projectId },
      replace: true,
    });
  },
});
