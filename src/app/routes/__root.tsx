import { createRootRoute } from "@tanstack/react-router";
import { AppErrorBoundary } from "../AppErrorBoundary";
import { AppShell } from "../AppShell";

export const rootRoute = createRootRoute({
  component: AppShell,
  errorComponent: ({ error, reset }) => (
    <AppErrorBoundary
      error={error instanceof Error ? error : new Error("Unknown application error")}
      onRetry={reset}
    />
  ),
});
