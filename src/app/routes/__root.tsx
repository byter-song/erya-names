import { createRootRoute } from "@tanstack/react-router";
import { AppErrorBoundary } from "../AppErrorBoundary";
import { InkScrollShell } from "../InkScrollShell";

export const rootRoute = createRootRoute({
  component: InkScrollShell,
  errorComponent: ({ error, reset }) => (
    <AppErrorBoundary
      error={error instanceof Error ? error : new Error("Unknown application error")}
      onRetry={reset}
    />
  ),
});
