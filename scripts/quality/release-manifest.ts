import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSelectedRuntimeBundle } from "../data/runtimeBundleSelection.ts";
import { ERYA_DATABASE_VERSION } from "../../src/infrastructure/database/EryaDatabase";
import { BACKUP_SCHEMA_VERSION } from "../../src/infrastructure/backup/backupSchema";
import { RULE_PACK_VERSION } from "../../src/domain/rules/rulePack";

interface ReleaseFile {
  path: string;
  bytes: Uint8Array;
}

export async function buildReleaseManifest(input: {
  appVersion: string;
  databaseVersion: number;
  backupSchemaVersion: number;
  datasetVersion: string;
  rulePackVersion: string;
  builtAt: string;
  files: ReleaseFile[];
}) {
  const files = [...input.files]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((file) => ({
      path: file.path,
      bytes: file.bytes.byteLength,
      sha256: createHash("sha256").update(file.bytes).digest("hex"),
    }));
  const artifactHash = createHash("sha256")
    .update(files.map((file) => `${file.path}\0${file.sha256}\0${file.bytes}`).join("\n"))
    .digest("hex");
  return {
    format: "erya-names-release-manifest",
    builtAt: input.builtAt,
    versions: {
      app: input.appVersion,
      database: input.databaseVersion,
      backupSchema: input.backupSchemaVersion,
      dataset: input.datasetVersion,
      rulePack: input.rulePackVersion,
    },
    artifact: { sha256: artifactHash, files: files.length, entries: files },
  };
}

async function collectFiles(root: string, directory = root): Promise<ReleaseFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: ReleaseFile[] = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(root, absolute)));
    else if (entry.isFile()) {
      files.push({
        path: path.relative(root, absolute).split(path.sep).join("/"),
        bytes: new Uint8Array(await readFile(absolute)),
      });
    }
  }
  return files;
}

async function main() {
  const root = process.cwd();
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
    version: string;
  };
  const selectedBundle = loadSelectedRuntimeBundle(root);
  const manifest = await buildReleaseManifest({
    appVersion: packageJson.version,
    databaseVersion: ERYA_DATABASE_VERSION,
    backupSchemaVersion: BACKUP_SCHEMA_VERSION,
    datasetVersion: selectedBundle.manifest.version,
    rulePackVersion: RULE_PACK_VERSION,
    builtAt: process.env.SOURCE_DATE_EPOCH
      ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
      : new Date().toISOString(),
    files: await collectFiles(path.join(root, "dist")),
  });
  const outputDirectory = path.join(root, "output", "release");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "release-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  process.stdout.write(`${manifest.artifact.sha256}  dist\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
