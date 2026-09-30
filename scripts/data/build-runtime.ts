import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { buildRuntimeBundle } from "./release";
import { loadJsonl } from "./reviewStore";
import { sourceManifestSchema } from "./sourceManifest";

const metadataPath = process.argv[2];
if (!metadataPath)
  throw new Error("Usage: npm run data:build-runtime -- <release-metadata.json>");
const metadata = JSON.parse(await readFile(metadataPath, "utf8")) as {
  version: string;
  releasedAt: string;
  changelog: string[];
};
const sourceFiles = (await readdir("data/sources/sources")).filter((file) =>
  file.endsWith(".yaml"),
);
const sources = await Promise.all(
  sourceFiles.map(async (file) =>
    sourceManifestSchema.parse(
      parse(await readFile(path.join("data/sources/sources", file), "utf8")),
    ),
  ),
);
const bundle = buildRuntimeBundle({
  characters: (await loadJsonl("data/review/output/approved-characters.jsonl")) as never[],
  allusions: (await loadJsonl("data/review/output/approved-allusions.jsonl")) as never[],
  sources,
  ...metadata,
});
await mkdir("src/data/curated/releases", { recursive: true });
await writeFile(
  `src/data/curated/releases/${metadata.version}.json`,
  `${JSON.stringify(bundle)}\n`,
  "utf8",
);
await writeFile(
  "src/data/curated/releases/current.json",
  `${JSON.stringify(bundle)}\n`,
  "utf8",
);
console.log(`built production bundle ${metadata.version}`);
