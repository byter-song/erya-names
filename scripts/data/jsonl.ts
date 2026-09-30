import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function writeJsonl(target: string, records: unknown[]): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  const sorted = [...records].sort((left, right) =>
    String((left as { id?: unknown }).id ?? "").localeCompare(
      String((right as { id?: unknown }).id ?? ""),
    ),
  );
  await writeFile(
    target,
    `${sorted.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8",
  );
}
