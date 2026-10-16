import type { RuntimeBundle } from "./schema/runtimeBundle";

// Vite validates the selected corpus with runtimeBundleSchema before emitting the hashed asset.
// Repeating the full schema walk in the browser delays first render and cannot catch a different
// artifact, so the client only parses the already-validated same-origin JSON.
export let activeRuntimeBundle: RuntimeBundle =
  typeof __RUNTIME_BUNDLE__ !== "undefined"
    ? (__RUNTIME_BUNDLE__ as RuntimeBundle)
    : (undefined as unknown as RuntimeBundle);

export function initializeRuntimeBundle(input: unknown): void {
  activeRuntimeBundle = input as RuntimeBundle;
}
