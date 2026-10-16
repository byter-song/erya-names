import { describe, expect, it } from "vitest";
import {
  evaluateApplicationBundleBudget,
  evaluateBundleBudget,
  resolveStartupJavaScript,
  type ViteManifest,
} from "../../../scripts/quality/bundle-budget";

describe("bundle budget", () => {
  it("rejects an asset category above its raw or gzip limit", () => {
    const result = evaluateBundleBudget(
      [{ path: "assets/app.js", bytes: 101, gzipBytes: 51 }],
      { javascript: { raw: 100, gzip: 50 } },
    );
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(["javascript raw 101 > 100", "javascript gzip 51 > 50"]);
  });

  it("counts immediate bootstrap imports but leaves route and rule-pack chunks lazy", () => {
    const manifest: ViteManifest = {
      "index.html": {
        file: "assets/index.js",
        isEntry: true,
        dynamicImports: ["src/app/bootstrap.tsx"],
      },
      "src/app/bootstrap.tsx": {
        file: "assets/bootstrap.js",
        imports: ["_shared.js"],
        dynamicImports: ["src/app/routes/config.tsx"],
      },
      "_shared.js": { file: "assets/shared.js" },
      "src/app/routes/config.tsx": {
        file: "assets/config.js",
        dynamicImports: ["data/sources/personal/folklore/zodiac/rules.json?raw"],
      },
      "data/sources/personal/folklore/zodiac/rules.json?raw": {
        file: "assets/rules.js",
        src: "data/sources/personal/folklore/zodiac/rules.json?raw",
        isDynamicEntry: true,
      },
    };

    expect([...resolveStartupJavaScript(manifest)].sort()).toEqual([
      "assets/bootstrap.js",
      "assets/index.js",
      "assets/shared.js",
    ]);
    const report = evaluateApplicationBundleBudget(
      [
        { path: "assets/index.js", bytes: 10, gzipBytes: 5 },
        { path: "assets/bootstrap.js", bytes: 20, gzipBytes: 10 },
        { path: "assets/shared.js", bytes: 30, gzipBytes: 15 },
        { path: "assets/config.js", bytes: 40, gzipBytes: 20 },
        { path: "assets/rules.js", bytes: 50, gzipBytes: 25 },
      ],
      manifest,
    );
    expect(report.ok).toBe(true);
    expect(report.startup.totals.javascript).toEqual({ raw: 60, gzip: 30 });
    expect(report.rulePacks.totals.javascript).toEqual({ raw: 50, gzip: 25 });
    expect(report.rulePackFiles).toEqual(["assets/rules.js"]);
  });

  it("fails when a folklore document enters the startup dependency graph", () => {
    const manifest: ViteManifest = {
      "index.html": {
        file: "assets/index.js",
        isEntry: true,
        imports: ["data/sources/personal/folklore/zodiac/rules.json?raw"],
      },
      "data/sources/personal/folklore/zodiac/rules.json?raw": {
        file: "assets/rules.js",
        src: "data/sources/personal/folklore/zodiac/rules.json?raw",
      },
    };
    const report = evaluateApplicationBundleBudget(
      [
        { path: "assets/index.js", bytes: 10, gzipBytes: 5 },
        { path: "assets/rules.js", bytes: 50, gzipBytes: 25 },
      ],
      manifest,
    );
    expect(report.ok).toBe(false);
    expect(report.errors).toEqual(["folklore-rule-pack eagerly loaded: assets/rules.js"]);
  });
});
