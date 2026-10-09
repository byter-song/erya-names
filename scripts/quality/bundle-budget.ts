import { gzipSync } from "node:zlib";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

interface Asset {
  path: string;
  bytes: number;
  gzipBytes: number;
}
interface Limit {
  raw: number;
  gzip: number;
}
type Category = "javascript" | "css" | "fonts" | "data" | "other";

export const DEFAULT_BUNDLE_BUDGET: Partial<Record<Category, Limit>> = {
  javascript: { raw: 1_050_000, gzip: 350_000 },
  css: { raw: 140_000, gzip: 50_000 },
  fonts: { raw: 30_000, gzip: 30_000 },
  data: { raw: 1_300_000, gzip: 220_000 },
};

function category(asset: string): Category {
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

const result = evaluateBundleBudget(await collect(path.resolve("dist")));
await mkdir("output/performance", { recursive: true });
await writeFile(
  "output/performance/bundle-budget.json",
  `${JSON.stringify({ ...result, checkedAt: new Date().toISOString() }, null, 2)}\n`,
);
if (!result.ok) {
  process.stderr.write(`${result.errors.join("\n")}\n`);
  process.exitCode = 1;
} else process.stdout.write("Bundle budget passed.\n");
