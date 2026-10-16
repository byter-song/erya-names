import { gzipSync } from "node:zlib";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export interface Asset {
  path: string;
  bytes: number;
  gzipBytes: number;
}
interface Limit {
  raw: number;
  gzip: number;
}
type Category = "javascript" | "css" | "fonts" | "data" | "other";

export interface ViteManifestChunk {
  file: string;
  src?: string;
  imports?: string[];
  dynamicImports?: string[];
  isEntry?: boolean;
  isDynamicEntry?: boolean;
}

export type ViteManifest = Record<string, ViteManifestChunk>;

export const DEFAULT_BUNDLE_BUDGET: Partial<Record<Category, Limit>> = {
  javascript: { raw: 1_050_000, gzip: 350_000 },
  css: { raw: 140_000, gzip: 50_000 },
  fonts: { raw: 30_000, gzip: 30_000 },
  data: { raw: 1_300_000, gzip: 220_000 },
};

export const FOLKLORE_RULE_PACK_BUDGET = { raw: 100_000, gzip: 25_000 };

function category(asset: string): Category {
  if (asset.startsWith(".vite/")) return "other";
  if (asset.endsWith(".js")) return "javascript";
  if (asset.endsWith(".css")) return "css";
  if (/\.(?:woff2?|ttf|otf)$/.test(asset)) return "fonts";
  if (asset.endsWith(".json")) return "data";
  return "other";
}

export function evaluateBundleBudget(
  assets: Asset[],
  budget: Partial<Record<Category, Limit>> = DEFAULT_BUNDLE_BUDGET,
) {
  const totals = Object.fromEntries(
    (["javascript", "css", "fonts", "data", "other"] as Category[]).map((key) => [
      key,
      { raw: 0, gzip: 0 },
    ]),
  ) as Record<Category, { raw: number; gzip: number }>;
  for (const asset of assets) {
    const total = totals[category(asset.path)];
    total.raw += asset.bytes;
    total.gzip += asset.gzipBytes;
  }
  const errors: string[] = [];
  for (const [key, limit] of Object.entries(budget) as Array<[Category, Limit]>) {
    if (totals[key].raw > limit.raw)
      errors.push(`${key} raw ${totals[key].raw} > ${limit.raw}`);
    if (totals[key].gzip > limit.gzip)
      errors.push(`${key} gzip ${totals[key].gzip} > ${limit.gzip}`);
  }
  return { ok: errors.length === 0, totals, budget, errors, assets };
}

/**
 * Returns files fetched before the initial project-list screen is usable. The entry starts
 * bootstrap immediately, so bootstrap and its static imports count; route views and rule
 * documents stay outside this closure until their explicit dynamic import is requested.
 */
export function resolveStartupJavaScript(
  manifest: ViteManifest,
  eagerDynamicEntries: string[] = ["src/app/bootstrap.tsx"],
): Set<string> {
  const keys = [
    ...Object.entries(manifest)
      .filter(([, chunk]) => chunk.isEntry)
      .map(([key]) => key),
    ...eagerDynamicEntries.filter((key) => key in manifest),
  ];
  const visited = new Set<string>();
  const files = new Set<string>();
  while (keys.length) {
    const key = keys.pop();
    if (!key || visited.has(key)) continue;
    visited.add(key);
    const chunk = manifest[key];
    if (!chunk) continue;
    if (chunk.file.endsWith(".js")) files.add(chunk.file);
    keys.push(...(chunk.imports ?? []));
  }
  return files;
}

export function resolveFolkloreRulePackJavaScript(manifest: ViteManifest): Set<string> {
  return new Set(
    Object.entries(manifest)
      .filter(([key, chunk]) =>
        (chunk.src ?? key).startsWith("data/sources/personal/folklore/"),
      )
      .map(([, chunk]) => chunk.file)
      .filter((file) => file.endsWith(".js")),
  );
}

export function evaluateApplicationBundleBudget(assets: Asset[], manifest: ViteManifest) {
  const startupFiles = resolveStartupJavaScript(manifest);
  const rulePackFiles = resolveFolkloreRulePackJavaScript(manifest);
  const startupAssets = assets.filter(
    (asset) => !asset.path.endsWith(".js") || startupFiles.has(asset.path),
  );
  const startup = evaluateBundleBudget(startupAssets);
  const rulePacks = evaluateBundleBudget(
    assets.filter((asset) => rulePackFiles.has(asset.path)),
    { javascript: FOLKLORE_RULE_PACK_BUDGET },
  );
  const eagerRulePacks = [...rulePackFiles].filter((file) => startupFiles.has(file));
  const errors = [
    ...startup.errors.map((error) => `startup ${error}`),
    ...rulePacks.errors.map((error) => `folklore-rule-packs ${error}`),
    ...eagerRulePacks.map((file) => `folklore-rule-pack eagerly loaded: ${file}`),
  ];
  return {
    ok: errors.length === 0,
    errors,
    startup,
    rulePacks,
    allAssets: evaluateBundleBudget(assets, {}),
    startupFiles: [...startupFiles].sort(),
    rulePackFiles: [...rulePackFiles].sort(),
  };
}

async function collect(root: string, directory = root): Promise<Asset[]> {
  const output: Asset[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await collect(root, absolute)));
    else if (entry.isFile()) {
      const bytes = await readFile(absolute);
      output.push({
        path: path.relative(root, absolute).split(path.sep).join("/"),
        bytes: bytes.byteLength,
        gzipBytes: gzipSync(bytes).byteLength,
      });
    }
  }
  return output;
}

async function main() {
  const dist = path.resolve("dist");
  const manifest = JSON.parse(
    await readFile(path.join(dist, ".vite/manifest.json"), "utf8"),
  ) as ViteManifest;
  const result = evaluateApplicationBundleBudget(await collect(dist), manifest);
  await mkdir("output/performance", { recursive: true });
  await writeFile(
    "output/performance/bundle-budget.json",
    `${JSON.stringify({ ...result, checkedAt: new Date().toISOString() }, null, 2)}\n`,
  );
  if (!result.ok) {
    process.stderr.write(`${result.errors.join("\n")}\n`);
    process.exitCode = 1;
  } else process.stdout.write("Bundle budget passed.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
