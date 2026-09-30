import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApplicationContainer } from "../../src/infrastructure/container";
import { err, ok } from "../../src/domain/shared/result";
import { createProjectId } from "../../src/domain/shared/ids";

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return listTypeScriptFiles(absolutePath);
      }
      return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [absolutePath] : [];
    }),
  );
  return files.flat();
}

describe("architecture boundaries", () => {
  it("provides typed domain results and identifiers", () => {
    expect(ok(createProjectId("project-1"))).toEqual({ ok: true, value: "project-1" });
    expect(err("invalid")).toEqual({ ok: false, error: "invalid" });
  });

  it("creates an application container from injected infrastructure", () => {
    const database = { name: "test-database" };
    const container = createApplicationContainer({ database });

    expect(container.database).toBe(database);
  });

  it("keeps domain modules independent from UI and infrastructure packages", async () => {
    const domainRoot = path.resolve("src/domain");
    const files = await listTypeScriptFiles(domainRoot);
    const forbiddenImports = /from ["'](?:react|dexie|zustand|@tanstack\/react-router)/;

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(await readFile(file, "utf8")).not.toMatch(forbiddenImports);
    }
  });
});
