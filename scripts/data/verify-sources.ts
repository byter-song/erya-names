import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parse } from "yaml";
import { sourceManifestSchema } from "./sourceManifest";

const verifyRemote = process.argv.includes("--remote");
const pinnedSnapshots: PinnedSnapshotFile[] = [];
const manifests = (await readdir("data/sources/sources")).filter((file) =>
  file.endsWith(".yaml"),
);
for (const filename of manifests) {
  const source = sourceManifestSchema.parse(
    parse(await readFile(path.join("data/sources/sources", filename), "utf8")),
  );
  if (source.sourceType !== "git") {
    for (const file of [
      { path: source.license.file, sha256: source.license.sha256 },
      ...source.files,
    ]) {
      const bytes = await readFile(path.resolve(file.path));
      const checksum = createHash("sha256").update(bytes).digest("hex");
      if (checksum !== file.sha256)
        throw new Error(`${source.sourceId}:${file.path}: checksum mismatch`);
    }
    if (source.sourceType === "snapshot") pinnedSnapshots.push(...source.files);
    console.log(`verified ${source.sourceId} local pinned snapshots`);
    continue;
  }
  const cache = path.join("data/cache", source.sourceId);
  const commit = execFileSync("git", ["-C", cache, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  if (commit !== source.commit) throw new Error(`${source.sourceId}: commit mismatch`);
  for (const file of [
    { path: source.license.file, sha256: source.license.sha256 },
    ...source.files,
  ]) {
    const bytes = await readFile(path.join(cache, file.path));
    const checksum = createHash("sha256").update(bytes).digest("hex");
    if (checksum !== file.sha256)
      throw new Error(`${source.sourceId}:${file.path}: checksum mismatch`);
  }
  console.log(`verified ${source.sourceId}@${source.commit.slice(0, 12)}`);
}
if (verifyRemote) await verifyPinnedRevisions(pinnedSnapshots);

interface PinnedSnapshotFile {
  path: string;
  url: string;
  revision: string;
}

async function verifyPinnedRevisions(files: PinnedSnapshotFile[]): Promise<void> {
  if (files.length === 0) return;
  const filesByOrigin = new Map<string, PinnedSnapshotFile[]>();
  for (const file of files) {
    const origin = new URL(file.url).origin;
    filesByOrigin.set(origin, [...(filesByOrigin.get(origin) ?? []), file]);
  }
  for (const filesForOrigin of filesByOrigin.values()) {
    await verifyPinnedRevisionsForOrigin(filesForOrigin);
  }
  console.log(`verified ${files.length} excerpts against pinned remote revisions`);
}

async function verifyPinnedRevisionsForOrigin(files: PinnedSnapshotFile[]): Promise<void> {
  const endpoint = new URL("/w/api.php", new URL(files[0].url).origin);
  endpoint.search = new URLSearchParams({
    action: "query",
    prop: "revisions",
    revids: files.map((file) => file.revision).join("|"),
    rvprop: "ids|content",
    rvslots: "main",
    format: "json",
    formatversion: "2",
  }).toString();
  const response = await fetch(endpoint, {
    headers: { "User-Agent": "EryaNamesSourceAudit/0.1" },
  });
  if (!response.ok) throw new Error(`Pinned revision request failed (${response.status})`);
  const payload = (await response.json()) as {
    query?: {
      pages?: Array<{ revisions?: Array<RevisionPayload> }>;
    };
  };
  const revisions = new Map(
    (payload.query?.pages ?? [])
      .flatMap((page) => page.revisions ?? [])
      .map((revision) => [String(revision.revid), revision.slots?.main?.content]),
  );
  for (const file of files) {
    const content = revisions.get(file.revision);
    if (!content)
      throw new Error(`${file.path}: pinned revision ${file.revision} was not returned`);
    const excerptLines = (await readFile(file.path, "utf8"))
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    for (const line of excerptLines) {
      if (!content.includes(line))
        throw new Error(
          `${file.path}: excerpt is absent from pinned revision ${file.revision}`,
        );
    }
  }
}

interface RevisionPayload {
  revid?: number;
  slots?: { main?: { content?: string } };
}
