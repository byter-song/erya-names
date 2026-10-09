import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parse } from "yaml";
import { sourceManifestSchema, type SourceManifest } from "./sourceManifest";
import { prepareCachePaths, promoteVerifiedCache } from "./sourceCache";

const requested = process.argv.slice(2);
const manifests = await loadSources();
const selected = requested.length
  ? manifests.filter((source) => requested.includes(source.sourceId))
  : manifests;
if (requested.some((sourceId) => !selected.some((source) => source.sourceId === sourceId)))
  throw new Error("Unknown source id");
for (const source of selected) {
  if (!source.releaseEligible && !source.personalEligible)
    throw new Error(`${source.sourceId}: source is not eligible for a data bundle`);
  if (source.sourceType !== "git") {
    if (!(await verifyLocalSnapshot(source)))
      throw new Error(`${source.sourceId}: committed snapshot failed verification`);
    console.log(`verified local snapshot ${source.sourceId}`);
    continue;
  }
  const paths = await prepareCachePaths(
    path.resolve("data/cache"),
    source.sourceId,
    process.pid,
  );
  if (await verifyCache(paths.target, source)) {
    console.log(`cached ${source.sourceId}`);
    continue;
  }
  await rm(paths.temporary, { recursive: true, force: true });
  try {
    execFileSync("git", ["clone", "--filter=blob:none", source.repository, paths.temporary], {
      stdio: "inherit",
    });
    execFileSync("git", ["-C", paths.temporary, "checkout", "--detach", source.commit], {
      stdio: "inherit",
    });
    if (!(await verifyCache(paths.temporary, source)))
      throw new Error(`${source.sourceId}: downloaded cache failed verification`);
    await promoteVerifiedCache(paths);
  } catch (error) {
    await rm(paths.temporary, { recursive: true, force: true });
    throw error;
  }
}

async function loadSources(): Promise<SourceManifest[]> {
  const files = (await readdir("data/sources/sources")).filter((file) =>
    file.endsWith(".yaml"),
  );
  return Promise.all(
    files.map(async (file) =>
      sourceManifestSchema.parse(
        parse(await readFile(path.join("data/sources/sources", file), "utf8")),
      ),
    ),
  );
}

async function verifyCache(directory: string, source: SourceManifest): Promise<boolean> {
  if (source.sourceType !== "git") return false;
  try {
    const commit = execFileSync("git", ["-C", directory, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (commit !== source.commit) return false;
    for (const file of [
      { path: source.license.file, sha256: source.license.sha256 },
      ...source.files,
    ]) {
      const checksum = createHash("sha256")
        .update(await readFile(path.join(directory, file.path)))
        .digest("hex");
      if (checksum !== file.sha256) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function verifyLocalSnapshot(source: SourceManifest): Promise<boolean> {
  if (source.sourceType === "git") return false;
  try {
    for (const file of [
      { path: source.license.file, sha256: source.license.sha256 },
      ...source.files,
    ]) {
      const checksum = createHash("sha256")
        .update(await readFile(path.resolve(file.path)))
        .digest("hex");
      if (checksum !== file.sha256) return false;
    }
    return true;
  } catch {
    return false;
  }
}
