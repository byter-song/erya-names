import { readFileSync } from "node:fs";
import path from "node:path";
import {
  runtimeBundleSchema,
  type RuntimeBundle,
} from "../../src/data/schema/runtimeBundle.ts";

export function loadSelectedRuntimeBundle(root = process.cwd()): RuntimeBundle {
  const mode = process.env.ERYA_DATASET_MODE ?? "personal";
  if (!["development", "personal", "production"].includes(mode))
    throw new Error(`Unsupported ERYA_DATASET_MODE: ${mode}`);
  const relativePath =
    mode === "production"
      ? "src/data/curated/releases/current.json"
      : mode === "personal"
        ? "src/data/curated/personal-bundle.json"
        : "src/data/curated/dev-bundle.json";
  let raw: string;
  try {
    raw = readFileSync(path.join(root, relativePath), "utf8");
  } catch (error) {
    if (mode === "production")
      throw new Error(`Production runtime bundle is missing: ${relativePath}`, {
        cause: error,
      });
    throw error;
  }
  const bundle = runtimeBundleSchema.parse(JSON.parse(raw));
  if (bundle.manifest.status !== mode)
    throw new Error(`Expected ${mode} runtime bundle, got ${bundle.manifest.status}`);
  if (
    mode === "production" &&
    [...bundle.characters, ...bundle.allusions, ...bundle.personUsages].some(
      (entry) => entry.reviewStatus !== "verified",
    )
  )
    throw new Error(
      "Production data requires human-reviewed records; source_checked personal data is not eligible.",
    );
  if (mode === "production" && bundle.modernCombinations?.length)
    throw new Error(
      "Personal editorial combinations require a separate production content review.",
    );
  return bundle;
}
