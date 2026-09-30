import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { prepareCachePaths, promoteVerifiedCache } from "../../../scripts/data/sourceCache";

describe("source cache promotion", () => {
  it("creates the cache parent for a cold checkout", async () => {
    const root = path.join(os.tmpdir(), `erya-cache-${crypto.randomUUID()}`);
    const paths = await prepareCachePaths(root, "example", 42);
    await expect(writeFile(path.join(root, "probe"), "ok")).resolves.toBeUndefined();
    expect(paths.temporary).toBe(path.join(root, "example.tmp-42"));
  });

  it("restores the old cache if promotion fails", async () => {
    const root = path.join(os.tmpdir(), `erya-cache-${crypto.randomUUID()}`);
    const paths = await prepareCachePaths(root, "example", 43);
    await mkdir(paths.target);
    await mkdir(paths.temporary);
    await writeFile(path.join(paths.target, "value"), "old");
    await writeFile(path.join(paths.temporary, "value"), "new");

    await expect(
      promoteVerifiedCache(paths, {
        beforePromote: () => {
          throw new Error("injected-promotion-failure");
        },
      }),
    ).rejects.toThrow("injected-promotion-failure");
    await expect(readFile(path.join(paths.target, "value"), "utf8")).resolves.toBe("old");
  });
});
