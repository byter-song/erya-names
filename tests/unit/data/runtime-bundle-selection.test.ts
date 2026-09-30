import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import devBundle from "../../../src/data/curated/dev-bundle.json";
import { loadSelectedRuntimeBundle } from "../../../scripts/data/runtimeBundleSelection";

const roots: string[] = [];
afterEach(async () => {
  delete process.env.ERYA_DATASET_MODE;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("runtime bundle selection", () => {
  it("uses the personal bundle by default", () => {
    expect(loadSelectedRuntimeBundle()).toMatchObject({
      manifest: { status: "personal", version: "personal-2026.09.27" },
    });
  });

  it("requires a production current bundle in production mode", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "erya-runtime-"));
    roots.push(root);
    process.env.ERYA_DATASET_MODE = "production";
    expect(() => loadSelectedRuntimeBundle(root)).toThrow(
      /Production runtime bundle is missing/,
    );

    const target = path.join(root, "src/data/curated/releases");
    await mkdir(target, { recursive: true });
    await writeFile(
      path.join(target, "current.json"),
      JSON.stringify({
        ...devBundle,
        manifest: { ...devBundle.manifest, status: "production" },
      }),
    );
    expect(loadSelectedRuntimeBundle(root).manifest.status).toBe("production");
  });
});
