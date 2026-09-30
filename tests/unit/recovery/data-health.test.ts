import { describe, expect, it } from "vitest";
import { CheckLocalDataHealth } from "../../../src/application/use-cases/CheckLocalDataHealth";

describe("CheckLocalDataHealth", () => {
  it("reports a healthy supported database", async () => {
    const result = await new CheckLocalDataHealth(
      {
        inspect: async () => ({
          databaseVersion: 1,
          tableNames: ["projects", "profiles"],
          metadataValid: true,
          counts: { projects: 2 },
        }),
      },
      { supportedVersion: 1, requiredTables: ["projects", "profiles"] },
    ).execute();

    expect(result).toEqual(
      expect.objectContaining({ healthy: true, readOnly: false, errors: [] }),
    );
  });

  it("enters read-only mode for incompatible schema, missing tables or metadata", async () => {
    const result = await new CheckLocalDataHealth(
      {
        inspect: async () => ({
          databaseVersion: 2,
          tableNames: ["projects"],
          metadataValid: false,
          counts: { projects: 2 },
        }),
      },
      { supportedVersion: 1, requiredTables: ["projects", "profiles"] },
    ).execute();

    expect(result).toMatchObject({ healthy: false, readOnly: true });
    expect(result.errors).toEqual(
      expect.arrayContaining([
        "schema-incompatible",
        "missing-table:profiles",
        "invalid-metadata",
      ]),
    );
  });
});
