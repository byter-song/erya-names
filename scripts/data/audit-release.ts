import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { auditReleaseInput } from "./release";
import { sourceManifestSchema } from "./sourceManifest";
import { loadJsonl } from "./reviewStore";

const [characters, allusions, sourceFiles] = await Promise.all([
  loadJsonl<Record<string, unknown>>("data/review/output/approved-characters.jsonl"),
  loadJsonl<Record<string, unknown>>("data/review/output/approved-allusions.jsonl"),
  readdir("data/sources/sources"),
]);
const sources = await Promise.all(
  sourceFiles
    .filter((file) => file.endsWith(".yaml"))
    .map(async (file) =>
      sourceManifestSchema.parse(
        parse(await readFile(path.join("data/sources/sources", file), "utf8")),
      ),
    ),
);
const audit = auditReleaseInput({
  characters: characters as never[],
  allusions: allusions as never[],
  sources,
});
await mkdir("data/audit", { recursive: true });
await writeFile(
  "data/audit/release-audit.json",
  `${JSON.stringify({ generatedAt: new Date().toISOString(), ...audit }, null, 2)}\n`,
  "utf8",
);
console.log(JSON.stringify(audit, null, 2));
if (!audit.ok) process.exitCode = 1;
