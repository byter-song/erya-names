import { runtimeBundleSchema, type RuntimeBundle } from "./schema/runtimeBundle";
// Tests inject the small fixture. The app initializes from a same-origin, hashed data asset before loading routes.
export let activeRuntimeBundle: RuntimeBundle =
  typeof __RUNTIME_BUNDLE__ !== "undefined"
    ? runtimeBundleSchema.parse(__RUNTIME_BUNDLE__)
    : (undefined as unknown as RuntimeBundle);
export function initializeRuntimeBundle(input: unknown): void {
  activeRuntimeBundle = runtimeBundleSchema.parse(input);
}
