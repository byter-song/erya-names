import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

interface ExpectedEntry {
  path: string;
  bytes: number;
  sha256: string;
}
type ActualEntry = ExpectedEntry;

export function calculateArtifactHash(entries: ExpectedEntry[]): string {
  return createHash("sha256")
    .update(
      [...entries]
        .sort((left, right) => left.path.localeCompare(right.path))
        .map((entry) => `${entry.path}\0${entry.sha256}\0${entry.bytes}`)
        .join("\n"),
    )
    .digest("hex");
}

export function verifyArtifact(
  expected: { sha256: string; entries: ExpectedEntry[] },
  actual: ActualEntry[],
) {
  const actualByPath = new Map(actual.map((entry) => [entry.path, entry]));
  const expectedPaths = new Set(expected.entries.map((entry) => entry.path));
  const errors: string[] = [];
  for (const entry of expected.entries) {
    const found = actualByPath.get(entry.path);
    if (!found) errors.push(`missing:${entry.path}`);
    else if (found.bytes !== entry.bytes || found.sha256 !== entry.sha256)
      errors.push(`changed:${entry.path}`);
  }
  for (const entry of actual)
    if (!expectedPaths.has(entry.path)) errors.push(`unexpected:${entry.path}`);
  if (calculateArtifactHash(actual) !== expected.sha256) errors.push("artifact-hash-mismatch");
  return { ok: errors.length === 0, errors };
}

async function collect(root: string, directory = root): Promise<ActualEntry[]> {
  const output: ActualEntry[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await collect(root, absolute)));
    else if (entry.isFile()) {
      const bytes = await readFile(absolute);
      output.push({
        path: path.relative(root, absolute).split(path.sep).join("/"),
        bytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
  }
  return output;
}

if (process.argv[1]?.endsWith("verify-artifact.ts")) {
  const manifest = JSON.parse(
    await readFile("output/release/release-manifest.json", "utf8"),
  ) as {
    artifact: { sha256: string; entries: ExpectedEntry[] };
  };
  const result = verifyArtifact(manifest.artifact, await collect(path.resolve("dist")));
  if (!result.ok) {
    process.stderr.write(`${result.errors.join("\n")}\n`);
    process.exitCode = 1;
  } else process.stdout.write("Artifact matches release manifest.\n");
}
