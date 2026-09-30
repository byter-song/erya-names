import { describe, expect, it } from "vitest";
import { buildReleaseManifest } from "../../../scripts/quality/release-manifest";

describe("release manifest", () => {
  it("is deterministic and records every release version plus the artifact hash", async () => {
    const files = [
      { path: "index.html", bytes: new TextEncoder().encode("index") },
      { path: "assets/app.js", bytes: new TextEncoder().encode("app") },
    ];
    const first = await buildReleaseManifest({
      appVersion: "0.2.0",
      databaseVersion: 3,
      backupSchemaVersion: 2,
      datasetVersion: "dev-2026.09.17",
      rulePackVersion: "core-rules-1",
      builtAt: "2026-09-18T00:00:00.000Z",
      files,
    });
    const second = await buildReleaseManifest({
      appVersion: "0.2.0",
      databaseVersion: 3,
      backupSchemaVersion: 2,
      datasetVersion: "dev-2026.09.17",
      rulePackVersion: "core-rules-1",
      builtAt: "2026-09-18T00:00:00.000Z",
      files: [...files].reverse(),
    });

    expect(first).toEqual(second);
    expect(first.artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toMatchObject({
      versions: { app: "0.2.0", database: 3, backupSchema: 2 },
      artifact: { files: 2 },
    });
  });
});
